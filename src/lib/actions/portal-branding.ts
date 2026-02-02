"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { validateImageUrl, validateHexColor, validateOpacity } from "@/lib/security";

const PORTAL_BRANDING_ID = "00000000-0000-0000-0000-000000000001";

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

  const payload = {
    app_name,
    tagline,
    logo_url,
    favicon_url,
    primary_color,
    login_bg_color,
    login_bg_image_url,
    login_bg_overlay_opacity,
  };
  const { error } = await supabase.from("portal_branding").update(payload).eq("id", PORTAL_BRANDING_ID);

  if (error) {
    return { success: false, error: error.message };
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

export async function getPortalBranding(): Promise<PortalBrandingResult> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("portal_branding")
    .select("app_name, tagline, logo_url, primary_color, favicon_url, login_bg_color, login_bg_image_url, login_bg_overlay_opacity")
    .eq("id", PORTAL_BRANDING_ID)
    .single();

  if (error || !data) {
    return {
      app_name: "KT-Portal",
      tagline: "Client Portal",
      logo_url: null,
      primary_color: "231 48% 58%",
      favicon_url: null,
      login_bg_color: null,
      login_bg_image_url: null,
      login_bg_overlay_opacity: 0.5,
    };
  }

  const row = data as {
    app_name: string;
    tagline: string | null;
    logo_url: string | null;
    primary_color: string;
    favicon_url: string | null;
    login_bg_color: string | null;
    login_bg_image_url: string | null;
    login_bg_overlay_opacity: number | null;
  };
  return {
    app_name: row.app_name,
    tagline: row.tagline ?? "Client Portal",
    logo_url: row.logo_url ?? null,
    primary_color: row.primary_color ?? "231 48% 58%",
    favicon_url: row.favicon_url ?? null,
    login_bg_color: row.login_bg_color ?? null,
    login_bg_image_url: row.login_bg_image_url ?? null,
    login_bg_overlay_opacity: row.login_bg_overlay_opacity ?? 0.5,
  };
}
