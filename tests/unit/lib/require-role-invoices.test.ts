import { describe, expect, it } from "vitest"
import { canCreateInvoices, canManageInvoices } from "@/lib/require-role"

describe("invoice create vs manage eligibility", () => {
  it("lets partners create invoices even though they cannot manage them", () => {
    expect(canCreateInvoices("partner", false)).toBe(true)
    expect(canManageInvoices("partner", false)).toBe(false)
  })

  it("lets super admins and account-manager staff create and manage", () => {
    expect(canCreateInvoices("super_admin", false)).toBe(true)
    expect(canManageInvoices("super_admin", false)).toBe(true)
    expect(canCreateInvoices("staff", true)).toBe(true)
    expect(canManageInvoices("staff", true)).toBe(true)
  })

  it("rejects clients and non-account-manager staff from creating invoices", () => {
    expect(canCreateInvoices("client", false)).toBe(false)
    expect(canCreateInvoices("staff", false)).toBe(false)
    expect(canCreateInvoices("partner_staff", false)).toBe(false)
  })
})
