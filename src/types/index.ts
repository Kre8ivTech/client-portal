/**
 * Type exports for KT-Portal
 *
 * This file re-exports types from various modules for convenient imports.
 * In production, database types would also be exported from ./database.ts
 * after running: `supabase gen types typescript --local > src/types/database.ts`
 */

// Plan-related types
export * from './plans'

// Ticket-related types
export * from './tickets'
