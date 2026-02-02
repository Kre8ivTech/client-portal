import { z } from 'zod'

export const CONVERSATION_TYPES = ['direct', 'group', 'support', 'project', 'internal'] as const

export const conversationTypeSchema = z.enum(CONVERSATION_TYPES)

export const createConversationSchema = z.object({
  type: conversationTypeSchema,
  participantIds: z.array(z.string().uuid()).min(1, { message: 'At least one participant is required.' }),
  title: z.string().max(255).optional(),
  ticketId: z.string().uuid().optional(),
})

export type CreateConversationInput = z.infer<typeof createConversationSchema>

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1, { message: 'Message cannot be empty.' }).max(10000),
  messageType: z.enum(['text', 'file', 'system', 'action']).default('text'),
  attachments: z.array(z.object({
    url: z.string().url(),
    name: z.string(),
    type: z.string(),
    size: z.number(),
  })).optional(),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>

export const startDirectConversationSchema = z.object({
  userId: z.string().uuid({ message: 'Invalid user ID.' }),
  initialMessage: z.string().min(1, { message: 'Message cannot be empty.' }).max(10000).optional(),
})

export type StartDirectConversationInput = z.infer<typeof startDirectConversationSchema>
