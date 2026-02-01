import { z } from 'zod'

// Contract type enum
export const contractTypeEnum = z.enum([
  'service_agreement',
  'nda',
  'msa',
  'sow',
  'amendment',
  'other',
])

export type ContractType = z.infer<typeof contractTypeEnum>

// Signer role enum
export const signerRoleEnum = z.enum([
  'client',
  'contractor',
  'witness',
  'approver',
])

export type SignerRole = z.infer<typeof signerRoleEnum>

// Signer schema for contract sending
export const signerSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email too long'),
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name too long'),
  role: signerRoleEnum,
  signing_order: z.number()
    .int('Signing order must be an integer')
    .min(1, 'Signing order must start at 1')
    .max(50, 'Signing order too large'),
})

export type SignerInput = z.infer<typeof signerSchema>

// Contract creation schema
export const contractCreateSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(255, 'Title too long'),
  
  description: z.string()
    .min(1, 'Description is required')
    .max(5000, 'Description too long'),
  
  contract_type: contractTypeEnum,
  
  client_id: z.string()
    .uuid('Invalid client ID'),
  
  template_id: z.string()
    .uuid('Invalid template ID')
    .optional()
    .nullable(),
  
  expires_at: z.string()
    .datetime('Invalid datetime format')
    .optional()
    .nullable(),
  
  metadata: z.record(z.unknown())
    .optional()
    .nullable(),
})

export type ContractCreateInput = z.infer<typeof contractCreateSchema>

// Contract update schema (draft only)
export const contractUpdateSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(255, 'Title too long')
    .optional(),
  
  description: z.string()
    .min(1, 'Description is required')
    .max(5000, 'Description too long')
    .optional(),
  
  expires_at: z.string()
    .datetime('Invalid datetime format')
    .optional()
    .nullable(),
  
  metadata: z.record(z.unknown())
    .optional()
    .nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  'At least one field must be provided for update'
)

export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>

// Contract send schema
export const contractSendSchema = z.object({
  signers: z.array(signerSchema)
    .min(1, 'At least one signer is required')
    .max(50, 'Too many signers')
    .refine(
      (signers) => {
        const orders = signers.map(s => s.signing_order)
        const uniqueOrders = new Set(orders)
        return uniqueOrders.size === orders.length
      },
      'Signing orders must be unique'
    )
    .refine(
      (signers) => {
        const orders = signers.map(s => s.signing_order).sort((a, b) => a - b)
        for (let i = 0; i < orders.length; i++) {
          if (orders[i] !== i + 1) return false
        }
        return true
      },
      'Signing orders must be sequential starting from 1'
    )
    .refine(
      (signers) => {
        const emails = signers.map(s => s.email.toLowerCase())
        const uniqueEmails = new Set(emails)
        return uniqueEmails.size === emails.length
      },
      'Signer emails must be unique'
    ),
})

export type ContractSendInput = z.infer<typeof contractSendSchema>

// Contract status enum
export const contractStatusEnum = z.enum([
  'draft',
  'pending',
  'sent',
  'viewed',
  'signed',
  'completed',
  'expired',
  'cancelled',
  'rejected',
])

export type ContractStatus = z.infer<typeof contractStatusEnum>

// Contract status update schema
export const contractStatusUpdateSchema = z.object({
  status: contractStatusEnum,
  notes: z.string()
    .max(5000, 'Notes too long')
    .optional()
    .nullable(),
})

export type ContractStatusUpdateInput = z.infer<typeof contractStatusUpdateSchema>
