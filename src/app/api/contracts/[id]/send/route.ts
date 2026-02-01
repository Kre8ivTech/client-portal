import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { contractSendSchema } from '@/lib/validators/contract'
import { createEnvelope } from '@/lib/docusign/envelopes'
import { writeAuditLog } from '@/lib/audit'
import type { DocuSignDocument, DocuSignSigner } from '@/types/docusign'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/contracts/[id]/send
 * Send contract for signature via DocuSign
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info
    const { data: userRow } = await (supabase as any)
      .from('users')
      .select('organization_id, role, full_name, email')
      .eq('id', user.id)
      .single()

    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()
    const result = contractSendSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const input = result.data

    // Get existing contract
    const { data: contract, error: fetchError } = await (supabase as any)
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
      }
      console.error('Error fetching contract:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Check if contract is in draft status
    if (contract.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft contracts can be sent' },
        { status: 400 }
      )
    }

    // Ensure contract has content to sign
    if (!contract.content_html) {
      return NextResponse.json(
        { error: 'Contract must have content before sending' },
        { status: 400 }
      )
    }

    // Convert HTML to PDF buffer (in production, use a proper HTML-to-PDF library)
    // For now, we'll assume content_html is already base64 PDF or needs conversion
    const documentBase64 = Buffer.from(contract.content_html).toString('base64')

    // Prepare DocuSign document
    const document: DocuSignDocument = {
      documentBase64,
      name: contract.title,
      fileExtension: 'pdf',
      documentId: '1',
    }

    // Prepare DocuSign signers
    const signers: DocuSignSigner[] = input.signers.map((signer, index) => ({
      email: signer.email,
      name: signer.name,
      recipientId: String(index + 1),
      routingOrder: String(signer.signing_order),
    }))

    // Create DocuSign envelope
    let envelopeId: string
    let envelopeStatus: string

    try {
      const envelopeResult = await createEnvelope(
        document,
        signers,
        id,
        `Please sign: ${contract.title}`,
        contract.description || undefined
      )

      envelopeId = envelopeResult.envelopeId
      envelopeStatus = envelopeResult.status
    } catch (docusignError) {
      console.error('DocuSign error:', docusignError)
      return NextResponse.json(
        {
          error: 'Failed to create DocuSign envelope',
          details: docusignError instanceof Error ? docusignError.message : 'Unknown error',
        },
        { status: 500 }
      )
    }

    // Update contract with envelope info and status
    const { data: updatedContract, error: updateError } = await (supabase as any)
      .from('contracts')
      .update({
        envelope_id: envelopeId,
        status: 'pending_signature',
        sent_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating contract:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Create contract_signers records
    const signersData = input.signers.map((signer) => ({
      contract_id: id,
      email: signer.email,
      name: signer.name,
      role: signer.role,
      signing_order: signer.signing_order,
      status: 'pending',
      organization_id: userRow.organization_id,
    }))

    const { error: signersError } = await (supabase as any)
      .from('contract_signers')
      .insert(signersData)

    if (signersError) {
      console.error('Error creating signers:', signersError)
      // Don't fail the whole operation, just log it
    }

    // Write audit log
    await writeAuditLog({
      action: 'contract.sent',
      entity_type: 'contract',
      entity_id: id,
      old_values: { status: contract.status },
      new_values: {
        status: 'pending_signature',
        envelope_id: envelopeId,
      },
      details: {
        signers: input.signers.map(s => ({ email: s.email, role: s.role })),
        envelope_status: envelopeStatus,
      },
    })

    return NextResponse.json({
      data: updatedContract,
      envelope: {
        id: envelopeId,
        status: envelopeStatus,
      },
      message: 'Contract sent successfully',
    })
  } catch (err) {
    console.error('Error sending contract:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
