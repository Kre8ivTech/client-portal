import { describe, expect, it } from 'vitest'
import { escapeQboQueryValue } from '@/lib/quickbooks/query'
import { billedCustomerName } from '@/lib/quickbooks/connection'
import { canManageQuickBooks } from '@/lib/quickbooks/access'

describe('escapeQboQueryValue', () => {
  it('escapes quotes so DisplayName lookups cannot break the QBO query', () => {
    expect(escapeQboQueryValue("O'Brien LLC")).toBe("O" + String.fromCharCode(92) + "'Brien LLC")
  })
})

describe('billedCustomerName', () => {
  it('prefers the billed organization name over the issuer org', () => {
    expect(
      billedCustomerName({
        metadata: { billed_organization_name: 'Acme Child' },
        organization: { name: 'Parent Books' },
        client: { email: 'ada@acme.test', profiles: { name: 'Ada' } },
      }),
    ).toBe('Acme Child')
  })
})

describe('canManageQuickBooks', () => {
  it('allows partners as well as account managers', () => {
    expect(canManageQuickBooks('partner', false)).toBe(true)
    expect(canManageQuickBooks('client', false)).toBe(false)
  })
})
