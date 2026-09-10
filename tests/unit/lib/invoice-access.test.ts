import { describe, expect, it } from "vitest"
import {
  billedClientDisplayName,
  billedClientOrganizationId,
  billedClientOrganizationName,
  canAccessInvoiceDetail,
} from "@/lib/invoices/access"

const issuerOrg = "11111111-1111-1111-1111-111111111111"
const billedOrg = "22222222-2222-2222-2222-222222222222"
const otherOrg = "33333333-3333-3333-3333-333333333333"
const billedClientId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const colleagueId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

const invoice = {
  organization_id: issuerOrg,
  client_id: billedClientId,
  billed_organization_id: billedOrg,
}

describe("canAccessInvoiceDetail", () => {
  it("allows super admins and staff regardless of org", () => {
    expect(
      canAccessInvoiceDetail(
        { id: "staff-1", organization_id: otherOrg, role: "super_admin" },
        invoice,
      ),
    ).toBe(true)
    expect(
      canAccessInvoiceDetail(
        { id: "staff-2", organization_id: otherOrg, role: "staff" },
        invoice,
      ),
    ).toBe(true)
  })

  it("allows viewers in the issuer organization", () => {
    expect(
      canAccessInvoiceDetail(
        { id: "partner-1", organization_id: issuerOrg, role: "partner" },
        invoice,
      ),
    ).toBe(true)
  })

  it("allows the billed client even when their org is not the issuer", () => {
    expect(
      canAccessInvoiceDetail(
        { id: billedClientId, organization_id: billedOrg, role: "client" },
        invoice,
      ),
    ).toBe(true)
  })

  it("allows other users in the billed client organization", () => {
    expect(
      canAccessInvoiceDetail(
        { id: colleagueId, organization_id: billedOrg, role: "client" },
        invoice,
      ),
    ).toBe(true)
  })

  it("denies unrelated tenants", () => {
    expect(
      canAccessInvoiceDetail(
        { id: "outsider", organization_id: otherOrg, role: "client" },
        invoice,
      ),
    ).toBe(false)
    expect(
      canAccessInvoiceDetail(
        { id: "outsider", organization_id: otherOrg, role: "partner" },
        invoice,
      ),
    ).toBe(false)
  })
})

describe("billed client display helpers", () => {
  it("prefers the profile name and unwraps relation arrays", () => {
    expect(
      billedClientDisplayName({
        email: "ada@client.test",
        profiles: [{ name: "Ada Client" }],
      }),
    ).toBe("Ada Client")
    expect(billedClientOrganizationName({ organizations: { name: "Child Co" } })).toBe("Child Co")
    expect(billedClientOrganizationId({ organization_id: billedOrg })).toBe(billedOrg)
  })
})
