'use server'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/notifications/providers/email'

/**
 * Fetch contract with signer emails for notification purposes.
 */
async function getContractWithSigners(contractId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from('contracts')
    .select('*, organization:organizations(id, name)')
    .eq('id', contractId)
    .single()
  if (!data) return null

  // Get signers for this contract
  const { data: signers } = await supabaseAdmin
    .from('contract_signers')
    .select('email, name, status')
    .eq('contract_id', contractId)

  return { contract: data as any, signers: (signers || []) as any[] }
}

/**
 * Notify signers that a contract has been sent for signature.
 */
export async function notifyContractSent(contractId: string) {
  try {
    const result = await getContractWithSigners(contractId)
    if (!result) return

    const { contract, signers } = result
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app'

    // Notify each signer
    for (const signer of signers) {
      if (!signer.email) continue
      await sendEmail({
        to: signer.email,
        subject: `Contract Ready for Review: ${contract.title}`,
        message: `Hello ${signer.name || 'there'},\n\nA new contract "${contract.title}" has been sent to you for review and signature.\n\nPlease review and sign at your earliest convenience.\n\nView Contract: ${appUrl}/dashboard/contracts/${contractId}`,
        appUrl,
      })
    }
  } catch (error) {
    console.error('[Notifications] Failed to send contract-sent email:', error)
  }
}

/**
 * Notify admins/staff that a contract has been signed by all parties.
 */
export async function notifyContractSigned(contractId: string) {
  try {
    const result = await getContractWithSigners(contractId)
    if (!result) return

    const { contract } = result
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app'

    // Notify admin/staff
    const supabaseAdmin = getSupabaseAdmin()
    const { data: admins } = await supabaseAdmin
      .from('users')
      .select('email, full_name')
      .in('role', ['super_admin', 'staff'])
      .limit(10)

    for (const admin of (admins || []) as any[]) {
      if (!admin.email) continue
      await sendEmail({
        to: admin.email,
        subject: `Contract Signed: ${contract.title}`,
        message: `Hello ${admin.full_name || 'Admin'},\n\nThe contract "${contract.title}" has been signed by all parties.\n\nView Contract: ${appUrl}/dashboard/admin/contracts/${contractId}`,
        appUrl,
      })
    }
  } catch (error) {
    console.error('[Notifications] Failed to send contract-signed email:', error)
  }
}

/**
 * Notify admins/staff that a contract has been declined.
 */
export async function notifyContractDeclined(contractId: string, declinedByEmail?: string) {
  try {
    const result = await getContractWithSigners(contractId)
    if (!result) return

    const { contract } = result
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app'

    // Notify admin/staff
    const supabaseAdmin = getSupabaseAdmin()
    const { data: admins } = await supabaseAdmin
      .from('users')
      .select('email, full_name')
      .in('role', ['super_admin', 'staff'])
      .limit(10)

    for (const admin of (admins || []) as any[]) {
      if (!admin.email) continue
      await sendEmail({
        to: admin.email,
        subject: `Contract Declined: ${contract.title}`,
        message: `Hello ${admin.full_name || 'Admin'},\n\nThe contract "${contract.title}" has been declined${declinedByEmail ? ` by ${declinedByEmail}` : ''}.\n\nView Contract: ${appUrl}/dashboard/admin/contracts/${contractId}`,
        appUrl,
      })
    }
  } catch (error) {
    console.error('[Notifications] Failed to send contract-declined email:', error)
  }
}
