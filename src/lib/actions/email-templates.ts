'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'
import {
  type EmailTemplate,
  type EmailTemplateType,
  type TemplateVariable,
  VALID_TEMPLATE_TYPES
} from '@/lib/email-templates-shared'

/**
 * Get all email templates accessible to the current user
 */
export async function getEmailTemplates(options?: {
  templateType?: EmailTemplateType
  includeInactive?: boolean
  organizationId?: string | null
}) {
  try {
    const supabase = (await createServerSupabaseClient()) as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    let query = supabase
      .from('email_templates')
      .select('*')
      .order('template_type', { ascending: true })
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (options?.templateType) {
      query = query.eq('template_type', options.templateType)
    }

    if (!options?.includeInactive) {
      query = query.eq('is_active', true)
    }

    if (options?.organizationId !== undefined) {
      if (options.organizationId === null) {
        query = query.is('organization_id', null)
      } else {
        query = query.eq('organization_id', options.organizationId)
      }
    }

    const { data: templates, error } = await query

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: templates as EmailTemplate[] }
  } catch (error) {
    console.error('Error fetching email templates:', error)
    return { success: false, error: 'Failed to fetch email templates' }
  }
}

/**
 * Get a single email template by ID
 */
export async function getEmailTemplate(templateId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { data: template, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (error || !template) {
      return { success: false, error: 'Template not found' }
    }

    return { success: true, data: template as EmailTemplate }
  } catch (error) {
    console.error('Error fetching email template:', error)
    return { success: false, error: 'Failed to fetch email template' }
  }
}

/**
 * Get the effective template for a given type and organization
 * Priority: org-specific default > org-specific any > system default
 */
export async function getEffectiveTemplate(
  templateType: EmailTemplateType,
  organizationId?: string | null
) {
  try {
    const supabase = (await createServerSupabaseClient()) as any

    // First try org-specific default
    if (organizationId) {
      const { data: orgDefault } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_type', templateType)
        .eq('organization_id', organizationId)
        .eq('is_default', true)
        .eq('is_active', true)
        .single()

      if (orgDefault) {
        return { success: true, data: orgDefault as EmailTemplate }
      }

      // Then try any org template
      const { data: orgTemplate } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_type', templateType)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (orgTemplate) {
        return { success: true, data: orgTemplate as EmailTemplate }
      }
    }

    // Fall back to system default
    const { data: systemDefault } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_type', templateType)
      .is('organization_id', null)
      .eq('is_default', true)
      .eq('is_active', true)
      .single()

    if (systemDefault) {
      return { success: true, data: systemDefault as EmailTemplate }
    }

    // Last resort: any system template
    const { data: systemTemplate } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_type', templateType)
      .is('organization_id', null)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (systemTemplate) {
      return { success: true, data: systemTemplate as EmailTemplate }
    }

    return { success: false, error: 'No template found for this type' }
  } catch (error) {
    console.error('Error fetching effective template:', error)
    return { success: false, error: 'Failed to fetch template' }
  }
}

/**
 * Create a new email template
 */
export async function createEmailTemplate(data: {
  name: string
  template_type: EmailTemplateType
  subject: string
  body_html: string
  description?: string
  body_text?: string
  from_name?: string
  from_email?: string
  reply_to?: string
  variables?: TemplateVariable[]
  organization_id?: string | null
  is_default?: boolean
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
      return { success: false, error: 'Only staff and admin can create email templates' }
    }

    // Validate required fields
    if (!data.name || !data.subject || !data.body_html || !data.template_type) {
      return { success: false, error: 'Name, subject, body HTML, and template type are required' }
    }

    // Validate template type
    if (!VALID_TEMPLATE_TYPES.includes(data.template_type)) {
      return { success: false, error: 'Invalid template type' }
    }

    // Determine organization_id
    let organizationId = data.organization_id !== undefined ? data.organization_id : profile.organization_id
    if (organizationId === null && role !== 'super_admin') {
      return { success: false, error: 'Only super admin can create system templates' }
    }

    // Insert template
    const { data: template, error: insertError } = await supabase
      .from('email_templates')
      .insert({
        organization_id: organizationId,
        template_type: data.template_type,
        name: data.name,
        description: data.description || null,
        subject: data.subject,
        body_html: data.body_html,
        body_text: data.body_text || null,
        from_name: data.from_name || null,
        from_email: data.from_email || null,
        reply_to: data.reply_to || null,
        variables: data.variables || [],
        is_active: true,
        is_default: data.is_default || false,
        created_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    await writeAuditLog({
      action: 'email_template.create',
      entity_type: 'email_template',
      entity_id: template.id,
      new_values: {
        name: data.name,
        template_type: data.template_type,
        organization_id: organizationId
      }
    })

    revalidatePath('/dashboard/settings/email-templates')
    return { success: true, data: template as EmailTemplate }
  } catch (error) {
    console.error('Error creating email template:', error)
    return { success: false, error: 'Failed to create email template' }
  }
}

/**
 * Update an existing email template
 */
export async function updateEmailTemplate(
  templateId: string,
  data: {
    name?: string
    description?: string
    subject?: string
    body_html?: string
    body_text?: string
    from_name?: string
    from_email?: string
    reply_to?: string
    variables?: TemplateVariable[]
    is_active?: boolean
    is_default?: boolean
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
      return { success: false, error: 'Only staff and admin can update email templates' }
    }

    // Fetch existing template
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (fetchError || !existingTemplate) {
      return { success: false, error: 'Template not found' }
    }

    // Check permissions
    if (role !== 'super_admin') {
      if (existingTemplate.organization_id === null) {
        return { success: false, error: 'Only super admin can edit system templates' }
      }
      if (existingTemplate.organization_id !== profile.organization_id) {
        return { success: false, error: 'Permission denied' }
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.subject !== undefined) updateData.subject = data.subject
    if (data.body_html !== undefined) updateData.body_html = data.body_html
    if (data.body_text !== undefined) updateData.body_text = data.body_text
    if (data.from_name !== undefined) updateData.from_name = data.from_name
    if (data.from_email !== undefined) updateData.from_email = data.from_email
    if (data.reply_to !== undefined) updateData.reply_to = data.reply_to
    if (data.variables !== undefined) updateData.variables = data.variables
    if (data.is_active !== undefined) updateData.is_active = data.is_active
    if (data.is_default !== undefined) updateData.is_default = data.is_default

    const { data: updatedTemplate, error: updateError } = await supabase
      .from('email_templates')
      .update(updateData)
      .eq('id', templateId)
      .select()
      .single()

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    await writeAuditLog({
      action: 'email_template.update',
      entity_type: 'email_template',
      entity_id: templateId,
      old_values: {
        name: existingTemplate.name,
        subject: existingTemplate.subject,
        is_active: existingTemplate.is_active
      },
      new_values: updateData
    })

    revalidatePath('/dashboard/settings/email-templates')
    revalidatePath(`/dashboard/settings/email-templates/${templateId}`)
    return { success: true, data: updatedTemplate as EmailTemplate }
  } catch (error) {
    console.error('Error updating email template:', error)
    return { success: false, error: 'Failed to update email template' }
  }
}

/**
 * Delete an email template (soft delete)
 */
export async function deleteEmailTemplate(templateId: string) {
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
      return { success: false, error: 'Only staff and admin can delete email templates' }
    }

    // Fetch existing template
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('email_templates')
      .select('id, name, organization_id, is_active, is_default')
      .eq('id', templateId)
      .single()

    if (fetchError || !existingTemplate) {
      return { success: false, error: 'Template not found' }
    }

    // Check permissions
    if (role !== 'super_admin') {
      if (existingTemplate.organization_id === null) {
        return { success: false, error: 'Only super admin can delete system templates' }
      }
      if (existingTemplate.organization_id !== profile.organization_id) {
        return { success: false, error: 'Permission denied' }
      }
    }

    if (!existingTemplate.is_active) {
      return { success: false, error: 'Template is already deleted' }
    }

    // Soft delete
    const { error: updateError } = await supabase
      .from('email_templates')
      .update({
        is_active: false,
        is_default: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    await writeAuditLog({
      action: 'email_template.delete',
      entity_type: 'email_template',
      entity_id: templateId,
      old_values: {
        name: existingTemplate.name,
        is_active: true
      },
      new_values: {
        is_active: false
      }
    })

    revalidatePath('/dashboard/settings/email-templates')
    return { success: true, data: { id: templateId, is_active: false } }
  } catch (error) {
    console.error('Error deleting email template:', error)
    return { success: false, error: 'Failed to delete email template' }
  }
}

/**
 * Duplicate an email template
 */
export async function duplicateEmailTemplate(templateId: string) {
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
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (fetchError || !sourceTemplate) {
      return { success: false, error: 'Template not found' }
    }

    // Create a copy
    const { data: newTemplate, error: insertError } = await supabase
      .from('email_templates')
      .insert({
        organization_id: profile.organization_id,
        template_type: sourceTemplate.template_type,
        name: `${sourceTemplate.name} (Copy)`,
        description: sourceTemplate.description,
        subject: sourceTemplate.subject,
        body_html: sourceTemplate.body_html,
        body_text: sourceTemplate.body_text,
        from_name: sourceTemplate.from_name,
        from_email: sourceTemplate.from_email,
        reply_to: sourceTemplate.reply_to,
        variables: sourceTemplate.variables,
        is_active: true,
        is_default: false,
        created_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    await writeAuditLog({
      action: 'email_template.duplicate',
      entity_type: 'email_template',
      entity_id: newTemplate.id,
      new_values: {
        name: newTemplate.name,
        source_template_id: templateId
      }
    })

    revalidatePath('/dashboard/settings/email-templates')
    return { success: true, data: newTemplate as EmailTemplate }
  } catch (error) {
    console.error('Error duplicating email template:', error)
    return { success: false, error: 'Failed to duplicate email template' }
  }
}

/**
 * Set a template as the default for its type
 */
export async function setDefaultTemplate(templateId: string) {
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
      return { success: false, error: 'Only staff and admin can set default templates' }
    }

    // Fetch the template
    const { data: template, error: fetchError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (fetchError || !template) {
      return { success: false, error: 'Template not found' }
    }

    // Check permissions
    if (role !== 'super_admin') {
      if (template.organization_id === null) {
        return { success: false, error: 'Only super admin can set system template defaults' }
      }
      if (template.organization_id !== profile.organization_id) {
        return { success: false, error: 'Permission denied' }
      }
    }

    // The trigger will handle unsetting other defaults
    const { error: updateError } = await supabase
      .from('email_templates')
      .update({
        is_default: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    await writeAuditLog({
      action: 'email_template.set_default',
      entity_type: 'email_template',
      entity_id: templateId,
      new_values: {
        name: template.name,
        template_type: template.template_type,
        is_default: true
      }
    })

    revalidatePath('/dashboard/settings/email-templates')
    return { success: true }
  } catch (error) {
    console.error('Error setting default template:', error)
    return { success: false, error: 'Failed to set default template' }
  }
}

/**
 * Render template with provided variables
 */
export async function renderEmailTemplate(
  templateId: string,
  variables: Record<string, string>
) {
  try {
    const supabase = (await createServerSupabaseClient()) as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { data: template, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (error || !template) {
      return { success: false, error: 'Template not found' }
    }

    // Perform variable substitution
    let renderedSubject = template.subject
    let renderedHtml = template.body_html
    let renderedText = template.body_text || ''

    const templateVariables = (template.variables || []) as TemplateVariable[]

    for (const variable of templateVariables) {
      const placeholder = `{{${variable.name}}}`
      const value = variables[variable.name] || variable.default || ''
      const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g')

      renderedSubject = renderedSubject.replace(regex, value)
      renderedHtml = renderedHtml.replace(regex, value)
      renderedText = renderedText.replace(regex, value)
    }

    // Also replace any variables not defined in the template schema
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`
      const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g')

      renderedSubject = renderedSubject.replace(regex, value)
      renderedHtml = renderedHtml.replace(regex, value)
      renderedText = renderedText.replace(regex, value)
    }

    return {
      success: true,
      data: {
        subject: renderedSubject,
        html: renderedHtml,
        text: renderedText,
        from_name: template.from_name,
        from_email: template.from_email,
        reply_to: template.reply_to
      }
    }
  } catch (error) {
    console.error('Error rendering email template:', error)
    return { success: false, error: 'Failed to render email template' }
  }
}

