import { describe, expect, it } from 'vitest'
import {
  isInvoiceCreator,
  mapBillableClientRows,
  resolveBillableOrgIds,
} from '@/lib/invoices/billable-clients'

const parentOrg = '11111111-1111-1111-1111-111111111111'
const childOrg = '22222222-2222-2222-2222-222222222222'
const otherOrg = '33333333-3333-3333-3333-333333333333'

describe('resolveBillableOrgIds', () => {
  it('returns every organization for super admins', () => {
    expect(
      resolveBillableOrgIds({
        role: 'super_admin',
        organizationId: parentOrg,
        allOrgIds: [parentOrg, childOrg, otherOrg],
        childOrgIds: [childOrg],
      }),
    ).toEqual([parentOrg, childOrg, otherOrg])
  })

  it('includes the parent org and all child orgs for partners and account managers', () => {
    expect(
      resolveBillableOrgIds({
        role: 'partner',
        organizationId: parentOrg,
        allOrgIds: [otherOrg],
        childOrgIds: [childOrg],
      }),
    ).toEqual([parentOrg, childOrg])
  })

  it('deduplicates org ids', () => {
    expect(
      resolveBillableOrgIds({
        role: 'staff',
        organizationId: parentOrg,
        allOrgIds: [],
        childOrgIds: [parentOrg, childOrg, childOrg],
      }),
    ).toEqual([parentOrg, childOrg])
  })
})

describe('isInvoiceCreator', () => {
  it('allows super admins, account-manager staff, and partners', () => {
    expect(isInvoiceCreator({ id: '1', organization_id: parentOrg, role: 'super_admin', is_account_manager: false })).toBe(true)
    expect(isInvoiceCreator({ id: '1', organization_id: parentOrg, role: 'staff', is_account_manager: true })).toBe(true)
    expect(isInvoiceCreator({ id: '1', organization_id: parentOrg, role: 'partner', is_account_manager: false })).toBe(true)
  })

  it('rejects clients and non-account-manager staff', () => {
    expect(isInvoiceCreator({ id: '1', organization_id: parentOrg, role: 'client', is_account_manager: false })).toBe(false)
    expect(isInvoiceCreator({ id: '1', organization_id: parentOrg, role: 'staff', is_account_manager: false })).toBe(false)
  })
})

describe('mapBillableClientRows', () => {
  it('includes child-org clients and excludes the current user', () => {
    const mapped = mapBillableClientRows(
      [
        {
          id: 'admin-user',
          email: 'admin@parent.test',
          role: 'partner',
          organization_id: parentOrg,
          profiles: { name: 'Admin' },
          organizations: { name: 'Parent Co' },
        },
        {
          id: 'child-client',
          email: 'ada@child.test',
          role: 'client',
          organization_id: childOrg,
          profiles: { name: 'Ada Client' },
          organizations: { name: 'Child Co' },
        },
      ],
      'admin-user',
    )

    expect(mapped).toEqual([
      {
        id: 'child-client',
        email: 'ada@child.test',
        organization_id: childOrg,
        full_name: 'Ada Client',
        organization_name: 'Child Co',
      },
    ])
  })
})
