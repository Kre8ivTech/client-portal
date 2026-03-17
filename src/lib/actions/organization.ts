"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { updateOrganizationSchema, createOrganizationSchema } from "@/lib/validators/organization";
import { validateHexColor, validateImageUrl, validateOpacity } from "@/lib/security";

type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

function normalizeCustomDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const withoutProtocol = trimmed.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const host = withoutProtocol.split("/")[0] ?? "";
  if (!host) return null;

  const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
  if (!domainPattern.test(host)) {
    return null;
  }

  return host;
}

/**
 * Check if user can edit the organization
 */
async function canEditOrganization(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  orgId: string
): Promise<{ canEdit: boolean; role: string; userOrgId: string | null }> {
  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", userId)
    .single();

  type ProfileRow = { organization_id: string | null; role: string };
  const prof = profile as ProfileRow | null;
  const role = prof?.role ?? "client";
  const userOrgId = prof?.organization_id ?? null;

  // Super admins and staff can edit all
  if (role === "super_admin" || role === "staff") {
    return { canEdit: true, role, userOrgId };
  }

  // Check if this is user's own organization
  if (userOrgId === orgId && (role === "partner" || role === "partner_staff")) {
    return { canEdit: true, role, userOrgId };
  }

  // Check if this is a child organization of user's org (for partners)
  if (role === "partner" || role === "partner_staff") {
    const { data: org } = await supabase
      .from("organizations")
      .select("parent_org_id")
      .eq("id", orgId)
      .single();

    type OrgRow = { parent_org_id: string | null };
    const orgData = org as OrgRow | null;
    if (orgData && orgData.parent_org_id === userOrgId) {
      return { canEdit: true, role, userOrgId };
    }
  }

  return { canEdit: false, role, userOrgId };
}

/**
 * Update organization settings from form data
 */
export async function updateOrganization(
  orgId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const access = await canEditOrganization(supabase, user.id, orgId);

    const { data: orgData } = await (supabase as any)
      .from("organizations")
      .select("id, type, custom_domain")
      .eq("id", orgId)
      .single();

    const orgRow = orgData as { id: string; type: string; custom_domain?: string | null } | null;
    if (!orgRow) {
      return { success: false, error: "Organization not found" };
    }

    if (!access.canEdit) {
      return { success: false, error: "You do not have permission to edit this organization" };
    }

    // Parse form data
    const name = (formData.get("name") as string)?.trim();
    const slug = (formData.get("slug") as string)?.trim();
    const contactEmail = (formData.get("contact_email") as string)?.trim();
    const contactPhone = (formData.get("contact_phone") as string)?.trim();
    const billingStreet = (formData.get("billing_street") as string)?.trim();
    const billingCity = (formData.get("billing_city") as string)?.trim();
    const billingState = (formData.get("billing_state") as string)?.trim();
    const billingPostalCode = (formData.get("billing_postal_code") as string)?.trim();
    const billingCountry = (formData.get("billing_country") as string)?.trim();
    const logoUrl = (formData.get("logo_url") as string)?.trim();
    const primaryColor = (formData.get("primary_color") as string)?.trim();
    const customDomainInput = (formData.get("custom_domain") as string)?.trim();
    const appName = (formData.get("branding_app_name") as string)?.trim();
    const tagline = (formData.get("branding_tagline") as string)?.trim();
    const loginBgColorInput = (formData.get("login_bg_color") as string)?.trim();
    const loginBgImageInput = (formData.get("login_bg_image_url") as string)?.trim();
    const loginBgOverlayInput = (formData.get("login_bg_overlay_opacity") as string)?.trim();
    const customDomainVerifiedInput = formData.get("custom_domain_verified");

    // Build the update object
    const settings = {
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      billing_address: {
        street: billingStreet || undefined,
        city: billingCity || undefined,
        state: billingState || undefined,
        postal_code: billingPostalCode || undefined,
        country: billingCountry || undefined,
      },
    };

    // Only allow branding updates for admin/staff/partners (not clients)
    const canUpdateBranding = ["super_admin", "staff", "partner", "partner_staff"].includes(access.role);
    const normalizedDomain = normalizeCustomDomain(customDomainInput || null);
    const customDomainChanged = (orgRow.custom_domain ?? null) !== normalizedDomain;

    if (customDomainInput && !normalizedDomain) {
      return { success: false, error: "Custom domain must be a valid hostname (e.g. portal.example.com)" };
    }

    if (normalizedDomain && orgRow.type !== "partner") {
      return { success: false, error: "Custom domains are only available for partner organizations" };
    }

    if (normalizedDomain) {
      const { data: existingDomain } = await (supabase as any)
        .from("organizations")
        .select("id")
        .eq("custom_domain", normalizedDomain)
        .neq("id", orgId)
        .maybeSingle();

      if (existingDomain) {
        return { success: false, error: "This custom domain is already in use by another organization" };
      }
    }

    const isStaffAdmin = access.role === "super_admin" || access.role === "staff";
    const customDomainVerified =
      isStaffAdmin && customDomainVerifiedInput === "on" && Boolean(normalizedDomain) && !customDomainChanged;

    const validatedLogoUrl = validateImageUrl(logoUrl || null);
    const validatedPrimaryColor = (validateHexColor(primaryColor || null) ?? primaryColor) || null;
    const validatedBgColor = validateHexColor(loginBgColorInput || null);
    const validatedBgImage = validateImageUrl(loginBgImageInput || null);
    const validatedBgOverlay = loginBgOverlayInput ? validateOpacity(loginBgOverlayInput) : null;

    const brandingConfig = canUpdateBranding ? {
      app_name: appName || null,
      tagline: tagline || null,
      logo_url: validatedLogoUrl,
      primary_color: validatedPrimaryColor,
      login_bg_color: validatedBgColor,
      login_bg_image_url: validatedBgImage,
      login_bg_overlay_opacity: validatedBgOverlay,
    } : undefined;

    const updateData: Record<string, unknown> = {
      settings,
    };

    // Only include branding_config if user has permission
    if (brandingConfig !== undefined) {
      updateData.branding_config = brandingConfig;
    }

    if (orgRow.type === "partner") {
      updateData.custom_domain = normalizedDomain;
      updateData.custom_domain_verified = customDomainChanged ? false : customDomainVerified;
      if (customDomainChanged) {
        updateData.custom_domain_verified_at = null;
      } else if (customDomainVerified) {
        updateData.custom_domain_verified_at = new Date().toISOString();
      }
    }

    if (name) updateData.name = name;
    if (slug) updateData.slug = slug;

    // Validate the update
    const validation = updateOrganizationSchema.safeParse(updateData);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
    }

    // Check slug uniqueness if changed
    if (slug) {
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .neq("id", orgId)
        .single();

      if (existingOrg) {
        return { success: false, error: "An organization with this slug already exists" };
      }
    }

    // Update the organization
    const { error } = await (supabase as any)
      .from("organizations")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);

    if (error) {
      return { success: false, error: error.message };
    }

    await writeAuditLog({
      action: "organization.update",
      entity_type: "organization",
      entity_id: orgId,
      new_values: { name, slug, settings: { contact_email: contactEmail } },
    });

    revalidatePath(`/dashboard/clients/${orgId}`);
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/settings/white-label");

    return { success: true };
  } catch (err) {
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Create a new organization
 */
export async function createOrganization(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get user role
    const { data: profile } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    type ProfileRow = { organization_id: string | null; role: string };
    const prof = profile as ProfileRow | null;
    const role = prof?.role ?? "client";
    const userOrgId = prof?.organization_id ?? null;

    // Only allow super_admin, staff, and partners to create organizations
    if (!["super_admin", "staff", "partner"].includes(role)) {
      return { success: false, error: "You do not have permission to create organizations" };
    }

    // Parse form data
    const name = (formData.get("name") as string)?.trim();
    const slug = (formData.get("slug") as string)?.trim();
    const type = (formData.get("type") as string)?.trim() || "client";
    const contactEmail = (formData.get("contact_email") as string)?.trim();

    if (!name || !slug) {
      return { success: false, error: "Name and slug are required" };
    }

    // Build the input object
    const input: Record<string, unknown> = {
      name,
      slug,
      type,
      status: "active",
      settings: {
        contact_email: contactEmail || null,
      },
    };

    // Partners can only create client organizations under themselves
    if (role === "partner") {
      if (type !== "client") {
        return { success: false, error: "Partners can only create client organizations" };
      }
      input.parent_org_id = userOrgId;
    }

    // Validate
    const validation = createOrganizationSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
    }

    // Check slug uniqueness
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existingOrg) {
      return { success: false, error: "An organization with this slug already exists" };
    }

    // Create the organization
    const { data: newOrg, error } = await (supabase as any)
      .from("organizations")
      .insert(validation.data)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await writeAuditLog({
      action: "organization.create",
      entity_type: "organization",
      entity_id: newOrg?.id,
      new_values: { name, slug, type },
    });

    revalidatePath("/dashboard/clients");

    return { success: true, data: newOrg };
  } catch (err) {
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Deactivate an organization (soft delete)
 */
export async function deactivateOrganization(orgId: string): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get user role
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    type ProfileRow = { role: string };
    const role = (profile as ProfileRow | null)?.role ?? "client";

    // Only super_admin and staff can deactivate organizations
    if (role !== "super_admin" && role !== "staff") {
      return { success: false, error: "You do not have permission to deactivate organizations" };
    }

    // Update status to inactive
    const { error } = await (supabase as any)
      .from("organizations")
      .update({
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);

    if (error) {
      return { success: false, error: error.message };
    }

    await writeAuditLog({
      action: "organization.deactivate",
      entity_type: "organization",
      entity_id: orgId,
    });

    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${orgId}`);

    return { success: true };
  } catch (err) {
    return { success: false, error: "An unexpected error occurred" };
  }
}
