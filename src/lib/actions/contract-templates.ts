'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

type ContractType = 'service_agreement' | 'nda' | 'sow' | 'amendment' | 'custom'

type TemplateVariable = {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'email'
  required?: boolean
  default?: string
}

/**
 * Create a new contract template
 */
export async function createTemplate(data: {
  name: string
  description?: string
  contract_type: ContractType
  template_content: string
  variables?: TemplateVariable[]
  organization_id?: string | null
}) {
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
      return { success: false, error: 'Only staff and admin can create templates' }
    }

    // Validate required fields
    if (!data.name || !data.template_content || !data.contract_type) {
      return { success: false, error: 'Name, template content, and contract type are required' }
    }

    // Validate contract type
    const validTypes: ContractType[] = ['service_agreement', 'nda', 'sow', 'amendment', 'custom']
    if (!validTypes.includes(data.contract_type)) {
      return { success: false, error: 'Invalid contract type' }
    }

    // Determine organization_id (null for global templates, only super_admin can create global)
    let organizationId = data.organization_id !== undefined ? data.organization_id : profile.organization_id
    if (organizationId === null && role !== 'super_admin') {
      return { success: false, error: 'Only super admin can create global templates' }
    }

    // Insert template
    const { data: template, error: insertError } = await supabase
      .from('contract_templates')
      .insert({
        organization_id: organizationId,
        name: data.name,
        description: data.description || null,
        contract_type: data.contract_type,
        template_content: data.template_content,
        variables: data.variables || [],
        is_active: true,
        created_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    // Write audit log
    await writeAuditLog({
      action: 'contract_template.create',
      entity_type: 'contract_template',
      entity_id: template.id,
      new_values: {
        name: data.name,
        contract_type: data.contract_type,
        organization_id: organizationId
      }
    })

    revalidatePath('/dashboard/contracts/templates')
    return { success: true, data: template }
  } catch (error) {
    console.error('Error creating template:', error)
    return { success: false, error: 'Failed to create template' }
  }
}

/**
 * Update an existing contract template
 */
export async function updateTemplate(
  templateId: string,
  data: {
    name?: string
    description?: string
    template_content?: string
    variables?: TemplateVariable[]
    is_active?: boolean
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
      return { success: false, error: 'Only staff and admin can update templates' }
    }

    // Fetch existing template to verify access
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (fetchError || !existingTemplate) {
      return { success: false, error: 'Template not found' }
    }

    // Check if user has permission to update this template
    // Super admin can update any template
    // Staff can only update templates in their organization
    if (role !== 'super_admin') {
      if (existingTemplate.organization_id !== profile.organization_id) {
        return { success: false, error: 'Permission denied' }
      }
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.template_content !== undefined) updateData.template_content = data.template_content
    if (data.variables !== undefined) updateData.variables = data.variables
    if (data.is_active !== undefined) updateData.is_active = data.is_active

    // Update the template
    const { data: updatedTemplate, error: updateError } = await supabase
      .from('contract_templates')
      .update(updateData)
      .eq('id', templateId)
      .select()
      .single()

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Write audit log
    await writeAuditLog({
      action: 'contract_template.update',
      entity_type: 'contract_template',
      entity_id: templateId,
      old_values: {
        name: existingTemplate.name,
        is_active: existingTemplate.is_active
      },
      new_values: updateData
    })

    revalidatePath('/dashboard/contracts/templates')
    revalidatePath(`/dashboard/contracts/templates/${templateId}`)
    return { success: true, data: updatedTemplate }
  } catch (error) {
    console.error('Error updating template:', error)
    return { success: false, error: 'Failed to update template' }
  }
}

/**
 * Soft delete a contract template (set is_active = false)
 */
export async function deleteTemplate(templateId: string) {
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
      return { success: false, error: 'Only staff and admin can delete templates' }
    }

    // Fetch existing template to verify access
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('contract_templates')
      .select('id, name, organization_id, is_active')
      .eq('id', templateId)
      .single()

    if (fetchError || !existingTemplate) {
      return { success: false, error: 'Template not found' }
    }

    // Check if user has permission to delete this template
    if (role !== 'super_admin') {
      if (existingTemplate.organization_id !== profile.organization_id) {
        return { success: false, error: 'Permission denied' }
      }
    }

    if (!existingTemplate.is_active) {
      return { success: false, error: 'Template is already deleted' }
    }

    // Soft delete by setting is_active to false
    const { error: updateError } = await supabase
      .from('contract_templates')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Write audit log
    await writeAuditLog({
      action: 'contract_template.delete',
      entity_type: 'contract_template',
      entity_id: templateId,
      old_values: {
        name: existingTemplate.name,
        is_active: true
      },
      new_values: {
        is_active: false
      }
    })

    revalidatePath('/dashboard/contracts/templates')
    revalidatePath(`/dashboard/contracts/templates/${templateId}`)
    return { success: true, data: { id: templateId, is_active: false } }
  } catch (error) {
    console.error('Error deleting template:', error)
    return { success: false, error: 'Failed to delete template' }
  }
}

/**
 * Render template preview with sample data
 */
export async function renderTemplatePreview(
  templateId: string,
  metadata: Record<string, any> = {}
) {
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

    // Fetch the template
    const { data: template, error: templateError } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return { success: false, error: 'Template not found' }
    }

    // Check if user has access to this template
    const isStaff = profile?.role === 'staff' || profile?.role === 'super_admin'
    const isGlobalTemplate = template.organization_id === null
    const isSameOrg = template.organization_id === profile?.organization_id

    if (!isStaff && !isGlobalTemplate && !isSameOrg) {
      return { success: false, error: 'Permission denied' }
    }

    // Perform variable substitution
    let previewContent = template.template_content
    const variables = template.variables || []

    // If no metadata provided, use sample/default values
    const sampleData: Record<string, string> = {
      client_name: metadata.client_name || 'John Doe',
      client_email: metadata.client_email || 'john.doe@example.com',
      company_name: metadata.company_name || 'Kre8ivTech, LLC',
      service_description: metadata.service_description || 'Web Development Services',
      start_date: metadata.start_date || new Date().toISOString().split('T')[0],
      end_date: metadata.end_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      project_scope: metadata.project_scope || 'Custom web application development',
      payment_terms: metadata.payment_terms || 'Net 30',
      amount: metadata.amount || '$5,000.00',
      ...metadata
    }

    // Replace all variables
    for (const variable of variables) {
      const varName = variable.name || variable.key
      const placeholder = `{{${varName}}}`
      const value = sampleData[varName] || variable.default || `[${varName}]`
      previewContent = previewContent.replace(new RegExp(placeholder, 'g'), value)
    }

    return {
      success: true,
      data: {
        preview_content: previewContent,
        template_name: template.name,
        contract_type: template.contract_type,
        variables_used: variables,
        sample_data: sampleData
      }
    }
  } catch (error) {
    console.error('Error rendering template preview:', error)
    return { success: false, error: 'Failed to render template preview' }
  }
}

/**
 * Duplicate an existing contract template
 */
export async function duplicateTemplate(templateId: string) {
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
      return { success: false, error: 'Only staff and admin can duplicate templates' }
    }

    // Fetch the template to duplicate
    const { data: sourceTemplate, error: fetchError } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (fetchError || !sourceTemplate) {
      return { success: false, error: 'Template not found' }
    }

    // Check if user has access to this template
    const isGlobalTemplate = sourceTemplate.organization_id === null
    const isSameOrg = sourceTemplate.organization_id === profile?.organization_id

    if (role !== 'super_admin' && !isGlobalTemplate && !isSameOrg) {
      return { success: false, error: 'Permission denied' }
    }

    // Create a copy of the template
    const { data: newTemplate, error: insertError } = await supabase
      .from('contract_templates')
      .insert({
        organization_id: profile.organization_id, // New template belongs to user's org
        name: `${sourceTemplate.name} (Copy)`,
        description: sourceTemplate.description,
        contract_type: sourceTemplate.contract_type,
        template_content: sourceTemplate.template_content,
        variables: sourceTemplate.variables,
        is_active: true,
        created_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    // Write audit log
    await writeAuditLog({
      action: 'contract_template.duplicate',
      entity_type: 'contract_template',
      entity_id: newTemplate.id,
      new_values: {
        name: newTemplate.name,
        source_template_id: templateId
      }
    })

    revalidatePath('/dashboard/contracts/templates')
    return { success: true, data: newTemplate }
  } catch (error) {
    console.error('Error duplicating template:', error)
    return { success: false, error: 'Failed to duplicate template' }
  }
}
