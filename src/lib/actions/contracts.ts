'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'
import { escapeHtml, sanitizeHtml } from '@/lib/security'
import { triggerWebhooks } from '@/lib/zapier/webhooks'
import { notifyContractDeclined } from '@/lib/actions/contract-notifications'
import { normalizeDashboardRole } from '@/lib/require-role'
import { contractSendSchema, contractTemplateSubmitSchema } from '@/lib/validators/contract'
import {
  contractDocumentFromHtml,
  decideContractSubmit,
  DOCUSIGN_NOT_CONFIGURED_MESSAGE,
} from '@/lib/contracts/docusign-config'
import { CONTRACT_RECIPIENT_ROLES, CONTRACT_RECIPIENT_STATUSES } from '@/lib/contracts/recipients'

type ContractStatus = 'draft' | 'pending_signature' | 'signed' | 'expired' | 'cancelled'

type ContractSigner = {
  email: string
  name: string
  role: 'client' | 'company_representative' | 'witness' | 'approver'
  signing_order?: number
  user_id?: string
}

/**
 * Create a contract from a template with variable substitution
 */
export async function createContractFromTemplate(
  templateId: string,
  clientId: string,
  metadata: Record<string, any> = {}
) {
  try {
    const supabase = (await createServerSupabaseClient()) as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Get user profile and check permissions
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    const role = normalizeDashboardRole(profile?.role)
    if (role !== 'staff' && role !== 'super_admin') {
      return { success: false, error: 'Only staff and admin can create contracts' }
    }

    // Fetch the template
    const { data: template, error: templateError } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('id', templateId)
      .eq('is_active', true)
      .single()

    if (templateError || !template) {
      return { success: false, error: 'Template not found or inactive' }
    }

    // Validate client exists and belongs to organization
    const { data: client, error: clientError } = await supabase
      .from('users')
      .select('id, organization_id, email, role, status, profiles(name)')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return { success: false, error: 'Client not found' }
    }

    const clientStatus = client.status || 'active'
    if (
      !(CONTRACT_RECIPIENT_ROLES as readonly string[]).includes(client.role) ||
      !(CONTRACT_RECIPIENT_STATUSES as readonly string[]).includes(clientStatus)
    ) {
      return { success: false, error: 'Client not found' }
    }

    const organizationId = client.organization_id || profile.organization_id
    if (!organizationId) {
      return { success: false, error: 'No organization found' }
    }

    // Perform variable substitution on template content with HTML escaping
    let contractContent = template.template_content
    const variables = template.variables || []

    for (const variable of variables) {
      const key = variable.name || variable.key
      if (variable.required && !String(metadata[key] ?? '').trim()) {
        return { success: false, error: `Missing required field: ${variable.label || key}` }
      }
    }

    // Replace template variables with escaped metadata values to prevent XSS
    for (const variable of variables) {
      const placeholder = `{{${variable.name || variable.key}}}`
      const rawValue = metadata[variable.name || variable.key] || variable.default || ''
      // Escape HTML entities to prevent XSS attacks
      const value = escapeHtml(String(rawValue))
      contractContent = contractContent.replace(new RegExp(placeholder, 'g'), value)
    }
    
    // Sanitize the entire HTML content after substitution
    contractContent = sanitizeHtml(contractContent)

    // Create the contract
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        template_id: templateId,
        title: metadata.title || template.name,
        description: metadata.description || template.description,
        contract_type: template.contract_type,
        status: 'draft',
        content_html: contractContent,
        created_by: user.id,
        metadata: {
          ...metadata,
          variables: metadata
        }
      })
      .select()
      .single()

    if (contractError) {
      return { success: false, error: contractError.message }
    }

    // Write audit log
    await writeAuditLog({
      action: 'contract.create',
      entity_type: 'contract',
      entity_id: contract.id,
      new_values: {
        template_id: templateId,
        client_id: clientId,
        status: 'draft'
      }
    })

    // Trigger webhook for contract creation
    triggerWebhooks('contract.created', profile.organization_id, contract)

    revalidatePath('/dashboard/contracts')
    return { success: true, data: contract }
  } catch (error) {
    console.error('Error creating contract from template:', error)
    return { success: false, error: 'Failed to create contract' }
  }
}

/**
 * Update a draft contract
 */
export async function updateContractDraft(
  contractId: string,
  data: {
    title?: string
    description?: string
    metadata?: Record<string, any>
    expires_at?: string
  }
) {
  try {
    const supabase = (await createServerSupabaseClient()) as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Get user profile and check permissions
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    const role = profile?.role
    if (role !== 'staff' && role !== 'super_admin') {
      return { success: false, error: 'Only staff and admin can update contracts' }
    }

    // Verify contract exists and is in draft status
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('id, status, organization_id, title, description, metadata')
      .eq('id', contractId)
      .eq('organization_id', profile.organization_id)
      .single()

    if (fetchError || !contract) {
      return { success: false, error: 'Contract not found' }
    }

    if (contract.status !== 'draft') {
      return { success: false, error: 'Only draft contracts can be updated' }
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.expires_at !== undefined) updateData.expires_at = data.expires_at
    if (data.metadata !== undefined) {
      updateData.metadata = {
        ...contract.metadata,
        ...data.metadata
      }
    }

    // Update the contract
    const { error: updateError } = await supabase
      .from('contracts')
      .update(updateData)
      .eq('id', contractId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Write audit log
    await writeAuditLog({
      action: 'contract.update',
      entity_type: 'contract',
      entity_id: contractId,
      old_values: {
        title: contract.title,
        description: contract.description
      },
      new_values: updateData
    })

    revalidatePath('/dashboard/contracts')
    revalidatePath(`/dashboard/contracts/${contractId}`)
    return { success: true, data: updateData }
  } catch (error) {
    console.error('Error updating contract draft:', error)
    return { success: false, error: 'Failed to update contract' }
  }
}

function displayNameFromProfiles(
  profiles: { name?: string | null } | { name?: string | null }[] | null | undefined,
  fallback: string,
) {
  const row = Array.isArray(profiles) ? profiles[0] : profiles
  const name = row?.name?.trim()
  return name || fallback
}

/**
 * Create a contract from a template and send it through DocuSign.
 * When DocuSign is not configured, nothing is stored as sent.
 */
export async function submitNewContract(
  templateId: string,
  clientId: string,
  metadata: Record<string, string> = {},
) {
  const parsed = contractTemplateSubmitSchema.safeParse({ templateId, clientId, metadata })
  if (!parsed.success) {
    return { success: false as const, error: 'Validation failed' }
  }

  const decision = decideContractSubmit(process.env)
  if (decision.outcome !== 'send') {
    return { success: false as const, error: decision.message, code: 'docusign_not_configured' as const }
  }

  const supabase = (await createServerSupabaseClient()) as any
  const created = await createContractFromTemplate(
    parsed.data.templateId,
    parsed.data.clientId,
    parsed.data.metadata,
  )
  if (!created.success || !created.data) {
    return created
  }

  const { data: client } = await supabase
    .from('users')
    .select('id, email, profiles(name)')
    .eq('id', parsed.data.clientId)
    .single()

  if (!client?.email) {
    await supabase.from('contracts').delete().eq('id', created.data.id)
    return { success: false as const, error: 'Client not found' }
  }

  const sent = await sendContractForSignature(created.data.id, [
    {
      email: client.email,
      name: displayNameFromProfiles(client.profiles, client.email),
      role: 'client',
      signing_order: 1,
      user_id: client.id,
    },
  ])

  if (!sent.success) {
    if (sent.code !== 'envelope_created') {
      await supabase.from('contracts').delete().eq('id', created.data.id)
    }
    return {
      success: false as const,
      error: sent.error || 'Failed to send contract for signature',
    }
  }

  return { success: true as const, data: { ...created.data, ...sent.data } }
}

/**
 * Send a draft contract for signature through DocuSign.
 * Refuses when credentials are missing and does not mark the contract sent.
 */
export async function sendContractForSignature(
  contractId: string,
  signers: ContractSigner[]
) {
  try {
    const decision = decideContractSubmit(process.env)
    if (decision.outcome !== 'send') {
      return { success: false, error: DOCUSIGN_NOT_CONFIGURED_MESSAGE, code: 'docusign_not_configured' }
    }

    const parsedSigners = contractSendSchema.safeParse({
      signers: (signers || []).map((signer, index) => ({
        ...signer,
        signing_order: signer.signing_order || index + 1,
      })),
    })
    if (!parsedSigners.success) {
      return { success: false, error: 'Validation failed' }
    }

    const supabase = (await createServerSupabaseClient()) as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    const role = normalizeDashboardRole(profile?.role)
    if (role !== 'staff' && role !== 'super_admin') {
      return { success: false, error: 'Only staff and admin can send contracts' }
    }

    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('id, status, organization_id, title, description, content_html')
      .eq('id', contractId)
      .single()

    if (fetchError || !contract) {
      return { success: false, error: 'Contract not found' }
    }

    if (contract.status !== 'draft') {
      return { success: false, error: 'Only draft contracts can be sent for signature' }
    }

    if (!contract.content_html) {
      return { success: false, error: 'Contract must have content before sending' }
    }

    const signersData = parsedSigners.data.signers.map((signer, index) => ({
      contract_id: contractId,
      user_id: signers[index]?.user_id || null,
      email: signer.email,
      name: signer.name,
      role: signer.role,
      signing_order: signer.signing_order,
      status: 'pending' as const,
      docusign_recipient_id: String(index + 1),
    }))

    const { error: signersError } = await supabase
      .from('contract_signers')
      .insert(signersData)

    if (signersError) {
      return { success: false, error: signersError.message }
    }

    const document = contractDocumentFromHtml(contract.title, contract.content_html)
    const { createEnvelope } = await import('@/lib/docusign/envelopes')

    let envelopeId: string
    let envelopeStatus: string
    try {
      const envelope = await createEnvelope(
        document,
        parsedSigners.data.signers.map((signer, index) => ({
          email: signer.email,
          name: signer.name,
          recipientId: String(index + 1),
          routingOrder: String(signer.signing_order),
        })),
        contractId,
        `Please sign: ${contract.title}`,
        contract.description || undefined,
      )
      envelopeId = envelope.envelopeId
      envelopeStatus = envelope.status
    } catch (error) {
      await supabase.from('contract_signers').delete().eq('contract_id', contractId)
      console.error('DocuSign envelope error:', error)
      return { success: false, error: 'Failed to create DocuSign envelope' }
    }

    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        status: 'pending_signature',
        docusign_envelope_id: envelopeId,
        docusign_status: envelopeStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractId)

    if (updateError) {
      return {
        success: false,
        error: updateError.message,
        code: 'envelope_created',
        data: { docusign_envelope_id: envelopeId, docusign_status: envelopeStatus },
      }
    }

    await writeAuditLog({
      action: 'contract.send_for_signature',
      entity_type: 'contract',
      entity_id: contractId,
      new_values: {
        status: 'pending_signature',
        docusign_envelope_id: envelopeId,
        docusign_status: envelopeStatus,
        signers_count: signersData.length,
      },
    })

    revalidatePath('/dashboard/contracts')
    revalidatePath(`/dashboard/contracts/${contractId}`)
    revalidatePath('/dashboard/admin/contracts')
    revalidatePath(`/dashboard/admin/contracts/${contractId}`)
    return {
      success: true,
      data: {
        status: 'pending_signature',
        docusign_envelope_id: envelopeId,
        docusign_status: envelopeStatus,
        signers: signersData,
      },
    }
  } catch (error) {
    console.error('Error sending contract for signature:', error)
    return { success: false, error: 'Failed to send contract for signature' }
  }
}

/**
 * Cancel a contract (void DocuSign envelope if exists)
 */
export async function cancelContract(
  contractId: string,
  reason: string
) {
  try {
    const supabase = (await createServerSupabaseClient()) as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Get user profile and check permissions
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    const role = profile?.role
    if (role !== 'staff' && role !== 'super_admin') {
      return { success: false, error: 'Only staff and admin can cancel contracts' }
    }

    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'Cancellation reason is required' }
    }

    // Verify contract exists
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('id, status, organization_id, docusign_envelope_id')
      .eq('id', contractId)
      .eq('organization_id', profile.organization_id)
      .single()

    if (fetchError || !contract) {
      return { success: false, error: 'Contract not found' }
    }

    if (contract.status === 'cancelled') {
      return { success: false, error: 'Contract is already cancelled' }
    }

    if (contract.status === 'signed') {
      return { success: false, error: 'Signed contracts cannot be cancelled' }
    }

    // Update contract status
    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        status: 'cancelled',
        metadata: {
          ...contract.metadata,
          cancellation_reason: reason,
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', contractId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Write audit log
    await writeAuditLog({
      action: 'contract.cancel',
      entity_type: 'contract',
      entity_id: contractId,
      new_values: {
        status: 'cancelled',
        reason
      }
    })

    // Integrate with DocuSign API to void the envelope if it exists
    if (contract.docusign_envelope_id) {
      try {
        const { voidEnvelope } = await import('@/lib/docusign/envelopes')
        await voidEnvelope(contract.docusign_envelope_id, reason)
        
        await supabase
          .from('contracts')
          .update({
            docusign_status: 'voided'
          })
          .eq('id', contractId)
      } catch (dsError) {
        console.error('DocuSign void error:', dsError)
      }
    }

    // Fire-and-forget email notification for contract cancellation
    notifyContractDeclined(contractId).catch(() => {})

    revalidatePath('/dashboard/contracts')
    revalidatePath(`/dashboard/contracts/${contractId}`)
    return { success: true, data: { status: 'cancelled' } }
  } catch (error) {
    console.error('Error cancelling contract:', error)
    return { success: false, error: 'Failed to cancel contract' }
  }
}

/**
 * Get contract audit log
 */
export async function getContractAuditLog(contractId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    // Verify contract exists and user has access
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, organization_id, client_id')
      .eq('id', contractId)
      .single()

    if (contractError || !contract) {
      return { success: false, error: 'Contract not found' }
    }

    // Check if user has permission to view audit log
    const isStaff = profile?.role === 'staff' || profile?.role === 'super_admin'
    const isClient = contract.client_id === user.id
    const isSameOrg = contract.organization_id === profile?.organization_id

    if (!isStaff && !isClient && !isSameOrg) {
      return { success: false, error: 'Permission denied' }
    }

    // Fetch audit log entries
    const { data: auditLog, error: auditError } = await supabase
      .from('contract_audit_log')
      .select(`
        *,
        performed_by:users!contract_audit_log_performed_by_fkey(id, full_name, email)
      `)
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false })

    if (auditError) {
      return { success: false, error: auditError.message }
    }

    return { success: true, data: auditLog }
  } catch (error) {
    console.error('Error fetching contract audit log:', error)
    return { success: false, error: 'Failed to fetch audit log' }
  }
}

/**
 * Download contract (get presigned URL or document URL)
 */
export async function downloadContract(contractId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    // Verify contract exists and user has access
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, organization_id, client_id, document_url, status, title')
      .eq('id', contractId)
      .single()

    if (contractError || !contract) {
      return { success: false, error: 'Contract not found' }
    }

    // Check if user has permission to download
    const isStaff = profile?.role === 'staff' || profile?.role === 'super_admin'
    const isClient = contract.client_id === user.id
    const isSameOrg = contract.organization_id === profile?.organization_id

    if (!isStaff && !isClient && !isSameOrg) {
      return { success: false, error: 'Permission denied' }
    }

    if (!contract.document_url) {
      return { success: false, error: 'Contract document not available yet' }
    }

    // If document_url is already a full URL, return it
    if (contract.document_url.startsWith('http')) {
      // Write audit log
      await writeAuditLog({
        action: 'contract.download',
        entity_type: 'contract',
        entity_id: contractId,
        details: { document_url: contract.document_url }
      })

      return { success: true, data: { url: contract.document_url, title: contract.title } }
    }

    // Otherwise, generate presigned URL from Supabase Storage
    const { data: signedUrl, error: urlError } = await supabase
      .storage
      .from('contracts')
      .createSignedUrl(contract.document_url, 3600) // 1 hour expiry

    if (urlError || !signedUrl) {
      return { success: false, error: 'Failed to generate download URL' }
    }

    // Write audit log
    await writeAuditLog({
      action: 'contract.download',
      entity_type: 'contract',
      entity_id: contractId,
      details: { document_path: contract.document_url }
    })

    return { success: true, data: { url: signedUrl.signedUrl, title: contract.title } }
  } catch (error) {
    console.error('Error downloading contract:', error)
    return { success: false, error: 'Failed to download contract' }
  }
}
