import { z } from 'zod'
import { contractTypeEnum } from './contract'

// Variable schema for template variables
export const templateVariableSchema = z.object({
  name: z.string()
    .min(1, 'Variable name is required')
    .max(100, 'Variable name too long')
    .regex(
      /^[a-z][a-z0-9_]*$/,
      'Variable name must start with a letter and contain only lowercase letters, numbers, and underscores'
    ),
  label: z.string()
    .min(1, 'Label is required')
    .max(255, 'Label too long')
    .optional(),
  description: z.string()
    .max(1000, 'Description too long')
    .optional()
    .nullable(),
  type: z.enum(['text', 'number', 'date', 'email', 'phone', 'url'])
    .default('text'),
  required: z.boolean()
    .default(false),
  default_value: z.string()
    .max(1000, 'Default value too long')
    .optional()
    .nullable(),
})

export type TemplateVariable = z.infer<typeof templateVariableSchema>

// Template creation schema
export const templateCreateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name too long'),
  
  description: z.string()
    .min(1, 'Description is required')
    .max(5000, 'Description too long'),
  
  contract_type: contractTypeEnum,
  
  template_content: z.string()
    .min(1, 'Template content is required')
    .max(100000, 'Template content too long'),
  
  variables: z.array(templateVariableSchema)
    .max(100, 'Too many variables')
    .refine(
      (variables) => {
        const names = variables.map(v => v.name.toLowerCase())
        const uniqueNames = new Set(names)
        return uniqueNames.size === names.length
      },
      'Variable names must be unique'
    )
    .default([]),
})

export type TemplateCreateInput = z.infer<typeof templateCreateSchema>

// Template update schema
export const templateUpdateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name too long')
    .optional(),
  
  description: z.string()
    .min(1, 'Description is required')
    .max(5000, 'Description too long')
    .optional(),
  
  template_content: z.string()
    .min(1, 'Template content is required')
    .max(100000, 'Template content too long')
    .optional(),
  
  variables: z.array(templateVariableSchema)
    .max(100, 'Too many variables')
    .refine(
      (variables) => {
        const names = variables.map(v => v.name.toLowerCase())
        const uniqueNames = new Set(names)
        return uniqueNames.size === names.length
      },
      'Variable names must be unique'
    )
    .optional(),
  
  is_active: z.boolean()
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  'At least one field must be provided for update'
)

export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>

// Helper function to extract variables from template content
export function extractTemplateVariables(content: string): string[] {
  const variableRegex = /\{\{([a-z][a-z0-9_]*)\}\}/g
  const matches = content.matchAll(variableRegex)
  const variables = new Set<string>()
  
  for (const match of matches) {
    variables.add(match[1])
  }
  
  return Array.from(variables).sort()
}

// Helper function to validate template content has all declared variables
export function validateTemplateVariables(
  content: string,
  declaredVariables: TemplateVariable[]
): { valid: boolean; missingInContent: string[]; undeclared: string[] } {
  const contentVariables = new Set(extractTemplateVariables(content))
  const declaredNames = new Set(declaredVariables.map(v => v.name))
  
  const missingInContent = declaredVariables
    .filter(v => v.required && !contentVariables.has(v.name))
    .map(v => v.name)
  
  const undeclared = Array.from(contentVariables)
    .filter(name => !declaredNames.has(name))
  
  return {
    valid: missingInContent.length === 0 && undeclared.length === 0,
    missingInContent,
    undeclared,
  }
}
