"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { validateImageUrl, validateHexColor, validateOpacity } from "@/lib/security";
import { headers } from "next/headers";

const PORTAL_BRANDING_ID = "00000000-0000-0000-0000-000000000001";

function isMissingColumnError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  return (
    err?.code === "42703" ||
    /column .* does not exist/i.test(err?.message ?? "") ||
    /unknown column/i.test(err?.message ?? "")
  );
}

export type PortalBrandingInput = {
  app_name: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  favicon_url: string | null;
  login_bg_color: string | null;
  login_bg_image_url: string | null;
  login_bg_overlay_opacity: number;
};

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "231 48% 58%";
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lPct = Math.round(l * 100);
  return `${h} ${s}% ${lPct}%`;
}

export async function updatePortalBranding(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as { role?: string } | null)?.role;
  if (role !== "super_admin") {
    return { success: false, error: "Only portal administrators can update branding." };
  }

  const app_name = (formData.get("app_name") as string)?.trim() || "KT-Portal";
  const tagline = (formData.get("tagline") as string)?.trim() || null;
  
  // Validate and sanitize URLs to prevent CSS injection and other attacks
  const logo_url_input = (formData.get("logo_url") as string)?.trim() || null;
  const logo_url = validateImageUrl(logo_url_input);
  
  const favicon_url_input = (formData.get("favicon_url") as string)?.trim() || null;
  const favicon_url = validateImageUrl(favicon_url_input);
  
  const login_bg_image_url_input = (formData.get("login_bg_image_url") as string)?.trim() || null;
  const login_bg_image_url = validateImageUrl(login_bg_image_url_input);
  
  // Validate color inputs
  let primary_color = (formData.get("primary_color") as string)?.trim() || "231 48% 58%";
  const login_bg_color_input = (formData.get("login_bg_color") as string)?.trim() || null;
  const login_bg_color = login_bg_color_input ? validateHexColor(login_bg_color_input) : null;
  
  const login_bg_overlay_opacity_input = (formData.get("login_bg_overlay_opacity") as string) || "0.5";
  const login_bg_overlay_opacity = validateOpacity(login_bg_overlay_opacity_input);

  if (primary_color.startsWith("#")) {
    primary_color = hexToHsl(primary_color);
  }

  // Always update core branding fields (these exist in all deployed schemas).
  const basePayload = {
    app_name,
    tagline,
    logo_url,
    favicon_url,
    primary_color,
  };

  const { error: baseError } = await supabase
    .from("portal_branding")
    .update(basePayload)
    .eq("id", PORTAL_BRANDING_ID);

  if (baseError) {
    return { success: false, error: baseError.message };
  }

  // Best-effort update for optional login customization fields.
  // Some environments may not have these columns yet; we silently ignore missing-column errors.
  const loginPayload = {
    login_bg_color,
    login_bg_image_url,
    login_bg_overlay_opacity,
  };

  const { error: loginError } = await supabase
    .from("portal_branding")
    .update(loginPayload)
    .eq("id", PORTAL_BRANDING_ID);

  if (loginError && !isMissingColumnError(loginError)) {
    return { success: false, error: loginError.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/");
  revalidatePath("/login");
  return { success: true };
}

export type PortalBrandingResult = {
  app_name: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  favicon_url: string | null;
  login_bg_color: string | null;
  login_bg_image_url: string | null;
  login_bg_overlay_opacity: number;
};

function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const raw = host.trim().toLowerCase();
  if (!raw) return null;
  return raw.split(":")[0] ?? null;
}

function normalizeCustomDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const withoutProtocol = raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return withoutProtocol.split("/")[0] ?? null;
}

function normalizePrimaryColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#")) return hexToHsl(trimmed);
  return trimmed;
}

function mergeBranding(
  base: PortalBrandingResult,
  tenant: Record<string, unknown> | null,
  orgName: string | null
): PortalBrandingResult {
  if (!tenant) return base;

  const appName = (tenant.app_name as string | undefined)?.trim() || orgName || base.app_name;
  const tagline =
    (tenant.tagline as string | undefined)?.trim() ||
    (orgName ? `${orgName} Client Portal` : null) ||
    base.tagline;

  const primary = normalizePrimaryColor(tenant.primary_color as string | null) ?? base.primary_color;
  const logo = validateImageUrl((tenant.logo_url as string | null) ?? null) ?? base.logo_url;
  const favicon = validateImageUrl((tenant.favicon_url as string | null) ?? null) ?? base.favicon_url;
  const bgImage = validateImageUrl((tenant.login_bg_image_url as string | null) ?? null) ?? base.login_bg_image_url;
  const bgColor = validateHexColor((tenant.login_bg_color as string | null) ?? null) ?? base.login_bg_color;
  const bgOverlay = validateOpacity((tenant.login_bg_overlay_opacity as number | string | null) ?? base.login_bg_overlay_opacity);

  return {
    app_name: appName,
    tagline,
    logo_url: logo,
    primary_color: primary,
    favicon_url: favicon,
    login_bg_color: bgColor,
    login_bg_image_url: bgImage,
    login_bg_overlay_opacity: bgOverlay,
  };
}

export async function getPortalBranding(): Promise<PortalBrandingResult> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("portal_branding")
    // Avoid enumerating columns so missing optional columns don't throw a 400.
    .select("*")
    .eq("id", PORTAL_BRANDING_ID)
    .single();

  const fallback: PortalBrandingResult = {
    app_name: "KT-Portal",
    tagline: "Client Portal",
    logo_url: null,
    primary_color: "231 48% 58%",
    favicon_url: null,
    login_bg_color: null,
    login_bg_image_url: null,
    login_bg_overlay_opacity: 0.5,
  };

  if (error || !data) {
    return fallback;
  }

  const row = data as Record<string, unknown>;
  const baseBranding: PortalBrandingResult = {
    app_name: (row.app_name as string) ?? "KT-Portal",
    tagline: (row.tagline as string | null) ?? "Client Portal",
    logo_url: (row.logo_url as string | null) ?? null,
    primary_color: (row.primary_color as string | null) ?? "231 48% 58%",
    favicon_url: (row.favicon_url as string | null) ?? null,
    login_bg_color: (row.login_bg_color as string | null) ?? null,
    login_bg_image_url: (row.login_bg_image_url as string | null) ?? null,
    login_bg_overlay_opacity: (row.login_bg_overlay_opacity as number | null) ?? 0.5,
  };

  const hdrs = await headers();
  const requestHost = normalizeHost(hdrs.get("x-forwarded-host") ?? hdrs.get("host"));
  if (!requestHost || requestHost === "localhost" || requestHost === "127.0.0.1") {
    return baseBranding;
  }

  const domain = normalizeCustomDomain(requestHost);
  if (!domain) {
    return baseBranding;
  }

  const { data: organization, error: orgError } = await (supabase as any)
    .from("organizations")
    .select("name, branding_config, custom_domain, custom_domain_verified, type, status")
    .eq("custom_domain", domain)
    .eq("custom_domain_verified", true)
    .eq("type", "partner")
    .eq("status", "active")
    .maybeSingle();

  if (orgError && !isMissingColumnError(orgError)) {
    return baseBranding;
  }

  if (!organization) {
    return baseBranding;
  }

  const orgRow = organization as {
    name?: string | null;
    branding_config?: Record<string, unknown> | null;
  };

  return mergeBranding(baseBranding, orgRow.branding_config ?? null, orgRow.name ?? null);
}
