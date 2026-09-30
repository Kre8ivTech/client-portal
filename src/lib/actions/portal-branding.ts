"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { validateImageUrl, validateHexColor, validateOpacity } from "@/lib/security";
import { headers } from "next/headers";
import {
  hexToHsl,
  resolveWhiteLabelBranding,
  type PortalBranding,
  type WhiteLabelSource,
} from "@/lib/white-label/resolve-branding";

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

export type PortalBrandingResult = PortalBranding;

function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const raw = host.trim().toLowerCase();
  if (!raw) return null;
  return raw.split(":")[0] ?? null;
}

function isLocalHost(host: string | null): boolean {
  return !host || host === "localhost" || host === "127.0.0.1";
}

function isMissingFunctionError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  return err?.code === "PGRST202" || /could not find the function/i.test(err?.message ?? "");
}

function sourceFromRpc(data: unknown): WhiteLabelSource | null {
  const row = (Array.isArray(data) ? data[0] : data) as
    | { org_name?: string | null; branding_config?: Record<string, unknown> | null }
    | null;
  if (!row || typeof row !== "object") return null;
  return {
    orgName: row.org_name ?? null,
    brandingConfig: row.branding_config ?? null,
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
  const client = supabase as any;

  let hostSource: WhiteLabelSource | null = null;
  if (!isLocalHost(requestHost)) {
    const { data: hostData, error: hostError } = await client.rpc("white_label_branding_for_host", {
      request_host: requestHost,
    });
    if (!hostError) {
      hostSource = sourceFromRpc(hostData);
    } else if (!isMissingFunctionError(hostError) && !isMissingColumnError(hostError)) {
      hostSource = null;
    } else if (isMissingFunctionError(hostError)) {
      const { data: organization, error: orgError } = await client
        .from("organizations")
        .select("name, branding_config")
        .eq("custom_domain", requestHost)
        .eq("custom_domain_verified", true)
        .eq("type", "partner")
        .eq("status", "active")
        .maybeSingle();
      if (!orgError && organization) {
        hostSource = {
          orgName: organization.name ?? null,
          brandingConfig: organization.branding_config ?? null,
        };
      }
    }
  }

  const { data: sessionData, error: sessionError } = await client.rpc("current_white_label_branding");
  const sessionSource =
    sessionError || !sessionData ? null : sourceFromRpc(sessionData);

  return resolveWhiteLabelBranding(baseBranding, hostSource, sessionSource);
}
