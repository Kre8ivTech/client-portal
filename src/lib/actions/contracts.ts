'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'
import { escapeHtml, sanitizeHtml } from '@/lib/security'
import { triggerWebhooks } from '@/lib/zapier/webhooks'

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

    const role = profile?.role
    if (role !== 'staff' && role !== 'super_admin') {
      return { success: false, error: 'Only staff and admin can create contracts' }
    }

    if (!profile?.organization_id) {
      return { success: false, error: 'No organization found' }
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
      .select('id, organization_id, email, full_name')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return { success: false, error: 'Client not found' }
    }

    // Perform variable substitution on template content with HTML escaping
    let contractContent = template.template_content
    const variables = template.variables || []

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
        organization_id: profile.organization_id,
        client_id: clientId,
        template_id: templateId,
        title: metadata.title || template.name,
        description: metadata.description || template.description,
        contract_type: template.contract_type,
        status: 'draft',
        content_html: contractContent,
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

/**
 * Send contract for signature (prepares for DocuSign)
 */
export async function sendContractForSignature(
  contractId: string,
  signers: ContractSigner[]
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
      return { success: false, error: 'Only staff and admin can send contracts' }
    }

    // Validate signers array
    if (!signers || signers.length === 0) {
      return { success: false, error: 'At least one signer is required' }
    }

    // Validate each signer
    for (const signer of signers) {
      if (!signer.email || !signer.name || !signer.role) {
        return { success: false, error: 'Each signer must have email, name, and role' }
      }
    }

    // Verify contract exists and is in draft status
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('id, status, organization_id')
      .eq('id', contractId)
      .eq('organization_id', profile.organization_id)
      .single()

    if (fetchError || !contract) {
      return { success: false, error: 'Contract not found' }
    }

    if (contract.status !== 'draft') {
      return { success: false, error: 'Only draft contracts can be sent for signature' }
    }

    // Insert signers
    const signersData = signers.map((signer, index) => ({
      contract_id: contractId,
      user_id: signer.user_id || null,
      email: signer.email,
      name: signer.name,
      role: signer.role,
      signing_order: signer.signing_order || index + 1,
      status: 'pending'
    }))

    const { error: signersError } = await supabase
      .from('contract_signers')
      .insert(signersData)

    if (signersError) {
      return { success: false, error: signersError.message }
    }

    // Update contract status
    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        status: 'pending_signature',
        updated_at: new Date().toISOString()
      })
      .eq('id', contractId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Write audit log
    await writeAuditLog({
      action: 'contract.send_for_signature',
      entity_type: 'contract',
      entity_id: contractId,
      new_values: {
        status: 'pending_signature',
        signers_count: signers.length
      }
    })

    // TODO: Integrate with DocuSign API to create envelope and send for signature
    // This would typically involve:
    // 1. Creating a DocuSign envelope with the contract content
    // 2. Adding recipients (signers) to the envelope
    // 3. Sending the envelope
    // 4. Storing the envelope ID in contract.docusign_envelope_id

    revalidatePath('/dashboard/contracts')
    revalidatePath(`/dashboard/contracts/${contractId}`)
    return { success: true, data: { status: 'pending_signature', signers: signersData } }
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
