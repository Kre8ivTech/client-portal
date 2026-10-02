import { validateHexColor, validateImageUrl, validateOpacity } from "@/lib/security";
import {
  normalizeCustomDomain,
  resolveCustomDomainVerificationUpdate,
} from "@/lib/white-label/domain-verification";

const BRANDING_FIELDS = [
  "branding_app_name",
  "branding_tagline",
  "logo_url",
  "primary_color",
  "login_bg_color",
  "login_bg_image_url",
  "login_bg_overlay_opacity",
] as const;

const SETTINGS_FIELDS = [
  "contact_email",
  "contact_phone",
  "billing_street",
  "billing_city",
  "billing_state",
  "billing_postal_code",
  "billing_country",
] as const;

export type OrganizationSaveForm = {
  has(name: string): boolean;
  get(name: string): string | null;
};

export type OrganizationSavePatch = {
  error?: string;
  update: Record<string, unknown>;
};

function readText(form: OrganizationSaveForm, name: string): string | null {
  const value = form.get(name)?.trim() ?? "";
  return value || null;
}

/**
 * Build the organization columns a save is allowed to write.
 *
 * The client settings form and the white-label form both call the same
 * action, but they submit different fields. A missing custom domain or
 * branding field means "leave the stored value alone". Treating it as an
 * empty value clears a verified partner domain and drops the public login
 * back to platform branding.
 */
export function buildOrganizationSavePatch(input: {
  orgType: string;
  previousDomain: string | null | undefined;
  previousBranding: Record<string, unknown> | null | undefined;
  canUpdateBranding: boolean;
  isStaffAdmin: boolean;
  form: OrganizationSaveForm;
  now: string;
}): OrganizationSavePatch {
  const domainFieldPresent = input.form.has("custom_domain");
  const customDomainInput = domainFieldPresent ? readText(input.form, "custom_domain") : null;
  const normalizedDomain = domainFieldPresent ? normalizeCustomDomain(customDomainInput) : null;

  if (domainFieldPresent && customDomainInput && !normalizedDomain) {
    return {
      error: "Custom domain must be a valid hostname (e.g. portal.example.com)",
      update: {},
    };
  }

  if (normalizedDomain && input.orgType !== "partner") {
    return {
      error: "Custom domains are only available for partner organizations",
      update: {},
    };
  }

  const update: Record<string, unknown> = {};

  if (input.orgType === "partner" && domainFieldPresent) {
    const verificationUpdate = resolveCustomDomainVerificationUpdate({
      previousDomain: input.previousDomain,
      nextDomain: normalizedDomain,
      isStaffAdmin: input.isStaffAdmin,
      verificationChecked: input.form.get("custom_domain_verified") === "on",
      now: input.now,
    });
    Object.assign(update, { custom_domain: normalizedDomain, ...verificationUpdate });
  }

  const brandingTouched = BRANDING_FIELDS.some((field) => input.form.has(field));
  if (input.canUpdateBranding && brandingTouched) {
    const branding: Record<string, unknown> = { ...(input.previousBranding ?? {}) };
    if (input.form.has("branding_app_name")) branding.app_name = readText(input.form, "branding_app_name");
    if (input.form.has("branding_tagline")) branding.tagline = readText(input.form, "branding_tagline");
    if (input.form.has("logo_url")) branding.logo_url = validateImageUrl(readText(input.form, "logo_url"));
    if (input.form.has("primary_color")) {
      const primary = readText(input.form, "primary_color");
      branding.primary_color = (validateHexColor(primary) ?? primary) || null;
    }
    if (input.form.has("login_bg_color")) {
      branding.login_bg_color = validateHexColor(readText(input.form, "login_bg_color"));
    }
    if (input.form.has("login_bg_image_url")) {
      branding.login_bg_image_url = validateImageUrl(readText(input.form, "login_bg_image_url"));
    }
    if (input.form.has("login_bg_overlay_opacity")) {
      const overlay = readText(input.form, "login_bg_overlay_opacity");
      branding.login_bg_overlay_opacity = overlay ? validateOpacity(overlay) : null;
    }
    update.branding_config = branding;
  }

  if (SETTINGS_FIELDS.some((field) => input.form.has(field))) {
    update.settings = {
      contact_email: readText(input.form, "contact_email"),
      contact_phone: readText(input.form, "contact_phone"),
      billing_address: {
        street: readText(input.form, "billing_street") || undefined,
        city: readText(input.form, "billing_city") || undefined,
        state: readText(input.form, "billing_state") || undefined,
        postal_code: readText(input.form, "billing_postal_code") || undefined,
        country: readText(input.form, "billing_country") || undefined,
      },
    };
  }

  return { update };
}
