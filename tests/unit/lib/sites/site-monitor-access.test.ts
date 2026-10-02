// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  canCreateSiteMonitor,
  canOfferSiteMonitorForm,
  partnerCanAttachSiteMonitor,
  siteMonitorFormListsChildClientsOnly,
} from "@/lib/sites/site-monitor-access";

const partnerOrg = "11111111-1111-1111-1111-111111111111";
const childClient = {
  parentOrgId: partnerOrg,
  type: "client",
};
const otherClient = {
  parentOrgId: "22222222-2222-2222-2222-222222222222",
  type: "client",
};

describe("site monitor create access", () => {
  it("lets partner and partner_staff attach a monitor to their child client", () => {
    for (const role of ["partner", "partner_staff"] as const) {
      expect(
        canCreateSiteMonitor({
          role,
          actorOrganizationId: partnerOrg,
          actorOrganizationType: "partner",
          target: childClient,
        }),
      ).toBe(true);
      expect(canOfferSiteMonitorForm(role)).toBe(true);
      expect(siteMonitorFormListsChildClientsOnly(role)).toBe(true);
    }
  });

  it("rejects the partner org, unrelated clients, and non-client children", () => {
    const actor = {
      actorOrganizationId: partnerOrg,
      actorOrganizationType: "partner" as const,
    };

    expect(partnerCanAttachSiteMonitor({ ...actor, target: { parentOrgId: null, type: "partner" } })).toBe(false);
    expect(partnerCanAttachSiteMonitor({ ...actor, target: otherClient })).toBe(false);
    expect(
      partnerCanAttachSiteMonitor({
        ...actor,
        target: { parentOrgId: partnerOrg, type: "partner" },
      }),
    ).toBe(false);
    expect(partnerCanAttachSiteMonitor({ ...actor, target: null })).toBe(false);
    expect(
      partnerCanAttachSiteMonitor({
        actorOrganizationId: partnerOrg,
        actorOrganizationType: "client",
        target: childClient,
      }),
    ).toBe(false);
  });

  it("keeps platform managers unrestricted and blocks clients", () => {
    expect(
      canCreateSiteMonitor({
        role: "super_admin",
        actorOrganizationId: null,
        actorOrganizationType: "kre8ivtech",
        target: otherClient,
      }),
    ).toBe(true);
    expect(
      canCreateSiteMonitor({
        role: "staff",
        actorOrganizationId: partnerOrg,
        actorOrganizationType: "kre8ivtech",
        target: null,
      }),
    ).toBe(true);
    expect(canOfferSiteMonitorForm("staff")).toBe(true);
    expect(siteMonitorFormListsChildClientsOnly("staff")).toBe(false);
    expect(
      canCreateSiteMonitor({
        role: "client",
        actorOrganizationId: childClient.parentOrgId,
        actorOrganizationType: "client",
        target: childClient,
      }),
    ).toBe(false);
    expect(canOfferSiteMonitorForm("client")).toBe(false);
  });
});
