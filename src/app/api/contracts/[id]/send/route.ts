import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { contractSendSchema } from '@/lib/validators/contract'
import { createEnvelope } from '@/lib/docusign/envelopes'
import { writeAuditLog } from '@/lib/audit'
import { notifyContractSent } from '@/lib/actions/contract-notifications'
import {
  contractDocumentFromHtml,
  decideContractSubmit,
  DOCUSIGN_NOT_CONFIGURED_MESSAGE,
} from '@/lib/contracts/docusign-config'
import { normalizeDashboardRole } from '@/lib/require-role'

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
      .select('organization_id, role, email')
      .eq('id', user.id)
      .single()

    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const role = normalizeDashboardRole(userRow.role)
    if (role !== 'super_admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const decision = decideContractSubmit(process.env)
    if (decision.outcome !== 'send') {
      return NextResponse.json({ error: DOCUSIGN_NOT_CONFIGURED_MESSAGE }, { status: 503 })
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

    const document = contractDocumentFromHtml(contract.title, contract.content_html)

    const signers = input.signers.map((signer, index) => ({
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
        { error: 'Failed to create DocuSign envelope' },
        { status: 500 }
      )
    }

    // Update contract with envelope info and status
    const { data: updatedContract, error: updateError } = await (supabase as any)
      .from('contracts')
      .update({
        docusign_envelope_id: envelopeId,
        docusign_status: envelopeStatus,
        status: 'pending_signature',
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating contract:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Create contract_signers records
    const signersData = input.signers.map((signer, index) => ({
      contract_id: id,
      email: signer.email,
      name: signer.name,
      role: signer.role,
      signing_order: signer.signing_order,
      status: 'pending',
      docusign_recipient_id: String(index + 1),
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
        docusign_envelope_id: envelopeId,
        docusign_status: envelopeStatus,
      },
      details: {
        signers: input.signers.map(s => ({ email: s.email, role: s.role })),
        envelope_status: envelopeStatus,
      },
    })

    // Fire-and-forget email notification to signers
    notifyContractSent(id).catch(() => {})

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
