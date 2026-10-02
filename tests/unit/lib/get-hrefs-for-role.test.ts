import { describe, expect, it } from "vitest"
import {
  ADMIN_INTEGRATIONS_HREF,
  getHrefsForRole,
  ORG_INTEGRATIONS_HREF,
  PLATFORM_INTEGRATIONS_HREF,
} from "@/lib/navigation/get-hrefs-for-role"

describe("getHrefsForRole integrations", () => {
  it("points Settings Integrations at org QuickBooks for partners and account managers", () => {
    expect(getHrefsForRole("partner", false)).toContain(ORG_INTEGRATIONS_HREF)
    expect(getHrefsForRole("staff", true)).toContain(ORG_INTEGRATIONS_HREF)
    expect(getHrefsForRole("super_admin", false)).toContain(ORG_INTEGRATIONS_HREF)
  })

  it("shows org integrations to staff and partner staff for marketing credentials", () => {
    expect(getHrefsForRole("staff", false)).toContain(ORG_INTEGRATIONS_HREF)
    expect(getHrefsForRole("partner_staff", false)).toContain(ORG_INTEGRATIONS_HREF)
    expect(getHrefsForRole("client", false)).not.toContain(ORG_INTEGRATIONS_HREF)
  })

  it("gives partner staff real security and notification routes", () => {
    const hrefs = getHrefsForRole("partner_staff", false)
    expect(hrefs).toContain("/dashboard/settings/security")
    expect(hrefs).toContain("/dashboard/settings/notifications")
    expect(hrefs).not.toContain("/dashboard/settings#security")
    expect(hrefs).not.toContain("/dashboard/settings#notifications")
  })

  it("does not link to a proposals section that has no page", () => {
    expect(getHrefsForRole("client", false)).not.toContain("/dashboard/invoices#proposals")
    expect(getHrefsForRole("super_admin", false)).not.toContain("/dashboard/invoices#proposals")
  })

  it("shows sites and handoffs to clients and live chat to staff", () => {
    const client = getHrefsForRole("client", false)
    expect(client).toContain("/dashboard/sites")
    expect(client).toContain("/dashboard/handoffs")
    expect(client).not.toContain("/dashboard/support/chats")
    expect(getHrefsForRole("staff", false)).toContain("/dashboard/support/chats")
    expect(getHrefsForRole("staff", false)).toContain("/dashboard/admin/intake")
    expect(getHrefsForRole("partner", false)).toContain("/dashboard/support/chats")
    expect(getHrefsForRole("client", false)).not.toContain("/dashboard/admin/status")
  })

  it("gives staff and super admins the agent workflow manager", () => {
    expect(getHrefsForRole("super_admin", false)).toContain("/dashboard/admin/agents")
    expect(getHrefsForRole("staff", false)).toContain("/dashboard/admin/agents")
    expect(getHrefsForRole("partner", false)).not.toContain("/dashboard/admin/agents")
    expect(getHrefsForRole("client", false)).not.toContain("/dashboard/admin/agents")
  })

  it("exposes admin QuickBooks config and platform integrations to super admins only", () => {
    const admin = getHrefsForRole("super_admin", false)
    expect(admin).toContain(ADMIN_INTEGRATIONS_HREF)
    expect(admin).toContain(PLATFORM_INTEGRATIONS_HREF)
    expect(getHrefsForRole("partner", false)).not.toContain(ADMIN_INTEGRATIONS_HREF)
    expect(getHrefsForRole("partner", false)).not.toContain(PLATFORM_INTEGRATIONS_HREF)
    expect(getHrefsForRole("staff", true)).not.toContain(ADMIN_INTEGRATIONS_HREF)
  })
})
