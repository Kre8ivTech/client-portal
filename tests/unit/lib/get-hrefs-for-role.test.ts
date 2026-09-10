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

  it("does not show org QuickBooks to clients or non-account-manager staff", () => {
    expect(getHrefsForRole("client", false)).not.toContain(ORG_INTEGRATIONS_HREF)
    expect(getHrefsForRole("staff", false)).not.toContain(ORG_INTEGRATIONS_HREF)
    expect(getHrefsForRole("partner_staff", false)).not.toContain(ORG_INTEGRATIONS_HREF)
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
