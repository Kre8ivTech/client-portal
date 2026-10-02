// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveCustomDomainVerificationUpdate } from "@/lib/white-label/domain-verification";

const now = "2026-10-02T02:00:00.000Z";
const domain = "portal.embark-marketing.com";

describe("resolveCustomDomainVerificationUpdate", () => {
  it("leaves verification untouched when a partner saves branding without changing the domain", () => {
    expect(
      resolveCustomDomainVerificationUpdate({
        previousDomain: domain,
        nextDomain: domain,
        isStaffAdmin: false,
        verificationChecked: false,
        now,
      }),
    ).toEqual({});
  });

  it("ignores a forged verification checkbox from a non-staff save", () => {
    expect(
      resolveCustomDomainVerificationUpdate({
        previousDomain: domain,
        nextDomain: domain,
        isStaffAdmin: false,
        verificationChecked: true,
        now,
      }),
    ).toEqual({});
  });

  it("treats protocol, case, and trailing slash differences as the same domain", () => {
    expect(
      resolveCustomDomainVerificationUpdate({
        previousDomain: "https://Portal.Embark-Marketing.com/",
        nextDomain: domain,
        isStaffAdmin: false,
        verificationChecked: false,
        now,
      }),
    ).toEqual({});
  });

  it("resets verification when a non-staff user changes the domain", () => {
    expect(
      resolveCustomDomainVerificationUpdate({
        previousDomain: domain,
        nextDomain: "portal.other-agency.com",
        isStaffAdmin: false,
        verificationChecked: true,
        now,
      }),
    ).toEqual({
      custom_domain_verified: false,
      custom_domain_verified_at: null,
    });
  });

  it("resets verification when the domain is cleared", () => {
    expect(
      resolveCustomDomainVerificationUpdate({
        previousDomain: domain,
        nextDomain: null,
        isStaffAdmin: false,
        verificationChecked: false,
        now,
      }),
    ).toEqual({
      custom_domain_verified: false,
      custom_domain_verified_at: null,
    });
  });

  it("lets staff mark an unchanged domain verified", () => {
    expect(
      resolveCustomDomainVerificationUpdate({
        previousDomain: domain,
        nextDomain: domain,
        isStaffAdmin: true,
        verificationChecked: true,
        now,
      }),
    ).toEqual({
      custom_domain_verified: true,
      custom_domain_verified_at: now,
    });
  });

  it("lets staff clear verification without changing the domain", () => {
    expect(
      resolveCustomDomainVerificationUpdate({
        previousDomain: domain,
        nextDomain: domain,
        isStaffAdmin: true,
        verificationChecked: false,
        now,
      }),
    ).toEqual({
      custom_domain_verified: false,
      custom_domain_verified_at: null,
    });
  });

  it("resets verification when staff change the domain even if the checkbox stays on", () => {
    expect(
      resolveCustomDomainVerificationUpdate({
        previousDomain: domain,
        nextDomain: "portal.other-agency.com",
        isStaffAdmin: true,
        verificationChecked: true,
        now,
      }),
    ).toEqual({
      custom_domain_verified: false,
      custom_domain_verified_at: null,
    });
  });

  it("does not mark an empty domain verified", () => {
    expect(
      resolveCustomDomainVerificationUpdate({
        previousDomain: null,
        nextDomain: null,
        isStaffAdmin: true,
        verificationChecked: true,
        now,
      }),
    ).toEqual({});
  });
});
