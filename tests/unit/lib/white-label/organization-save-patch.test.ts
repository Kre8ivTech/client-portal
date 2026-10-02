// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildOrganizationSavePatch,
  type OrganizationSaveForm,
} from "@/lib/white-label/organization-save-patch";

const now = "2026-10-02T09:00:00.000Z";
const domain = "portal.embark-marketing.com";
const logo = "https://www.embark-marketing.com/wp-content/uploads/2025/05/Embark-Marketing-web-logo-small.png";

const storedBranding = {
  app_name: "Embark Marketing",
  tagline: "Portal",
  logo_url: logo,
  primary_color: "#5E2162",
  login_bg_color: "#EDE6DB",
  login_bg_image_url: null,
  login_bg_overlay_opacity: 0.5,
};

function form(entries: Record<string, string>): OrganizationSaveForm {
  return {
    has(name) {
      return Object.prototype.hasOwnProperty.call(entries, name);
    },
    get(name) {
      return Object.prototype.hasOwnProperty.call(entries, name) ? entries[name] : null;
    },
  };
}

function save(entries: Record<string, string>, overrides: Partial<Parameters<typeof buildOrganizationSavePatch>[0]> = {}) {
  return buildOrganizationSavePatch({
    orgType: "partner",
    previousDomain: domain,
    previousBranding: storedBranding,
    canUpdateBranding: true,
    isStaffAdmin: false,
    form: form(entries),
    now,
    ...overrides,
  });
}

describe("buildOrganizationSavePatch", () => {
  it("keeps a verified custom domain when the settings form omits it", () => {
    const result = save({
      name: "Embark Marketing",
      slug: "embark-marketing",
      contact_email: "hello@embark-marketing.com",
      logo_url: logo,
      primary_color: "#5E2162",
    });

    expect(result.error).toBeUndefined();
    expect(result.update.custom_domain).toBeUndefined();
    expect(result.update.custom_domain_verified).toBeUndefined();
    expect(result.update.branding_config).toMatchObject({
      app_name: "Embark Marketing",
      tagline: "Portal",
      logo_url: logo,
      primary_color: "#5E2162",
      login_bg_color: "#EDE6DB",
    });
    expect(result.update.settings).toMatchObject({
      contact_email: "hello@embark-marketing.com",
    });
  });

  it("leaves branding and contact settings alone when those fields are absent", () => {
    const result = save({
      custom_domain: domain,
    });

    expect(result.update.custom_domain).toBe(domain);
    expect(result.update.custom_domain_verified).toBeUndefined();
    expect(result.update.branding_config).toBeUndefined();
    expect(result.update.settings).toBeUndefined();
  });

  it("keeps verification when the white-label form resubmits the same domain", () => {
    const result = save({
      custom_domain: "HTTPS://Portal.Embark-Marketing.com/",
      branding_app_name: "Embark Marketing",
      branding_tagline: "Portal",
      logo_url: logo,
      primary_color: "#5E2162",
      login_bg_color: "#EDE6DB",
    });

    expect(result.error).toBeUndefined();
    expect(result.update.custom_domain).toBe(domain);
    expect(result.update.custom_domain_verified).toBeUndefined();
    expect(result.update.branding_config).toMatchObject({
      app_name: "Embark Marketing",
      tagline: "Portal",
      login_bg_color: "#EDE6DB",
    });
  });

  it("clears verification only when the domain field is submitted blank", () => {
    const result = save({
      custom_domain: "  ",
      branding_app_name: "Embark Marketing",
    });

    expect(result.update.custom_domain).toBeNull();
    expect(result.update.custom_domain_verified).toBe(false);
    expect(result.update.custom_domain_verified_at).toBeNull();
    expect(result.update.branding_config).toMatchObject({
      app_name: "Embark Marketing",
      tagline: "Portal",
      login_bg_color: "#EDE6DB",
    });
  });

  it("rejects an invalid domain without writing a patch", () => {
    const result = save({ custom_domain: "not a domain" });
    expect(result.error).toMatch(/valid hostname/);
    expect(result.update).toEqual({});
  });

  it("rejects a custom domain on a client organization", () => {
    const result = save(
      { custom_domain: domain },
      { orgType: "client", previousDomain: null },
    );
    expect(result.error).toMatch(/partner organizations/);
    expect(result.update).toEqual({});
  });
});
