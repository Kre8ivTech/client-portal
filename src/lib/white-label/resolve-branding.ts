import { validateHexColor, validateImageUrl, validateOpacity } from "@/lib/security";

export type PortalBranding = {
  app_name: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  favicon_url: string | null;
  login_bg_color: string | null;
  login_bg_image_url: string | null;
  login_bg_overlay_opacity: number;
};

export type WhiteLabelSource = {
  orgName: string | null;
  brandingConfig: Record<string, unknown> | null;
};

export function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "231 48% 58%";
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
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
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function normalizePrimaryColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#")) return hexToHsl(trimmed);
  return trimmed;
}

export function mergeBranding(
  base: PortalBranding,
  tenant: Record<string, unknown> | null,
  orgName: string | null,
): PortalBranding {
  if (!tenant && !orgName) return base;

  const appName = (tenant?.app_name as string | undefined)?.trim() || orgName || base.app_name;
  const tagline =
    (tenant?.tagline as string | undefined)?.trim() ||
    (orgName ? `${orgName} Client Portal` : null) ||
    base.tagline;

  const primary = normalizePrimaryColor(tenant?.primary_color as string | null) ?? base.primary_color;
  const logo = validateImageUrl((tenant?.logo_url as string | null) ?? null) ?? base.logo_url;
  const favicon = validateImageUrl((tenant?.favicon_url as string | null) ?? null) ?? base.favicon_url;
  const bgImage = validateImageUrl((tenant?.login_bg_image_url as string | null) ?? null) ?? base.login_bg_image_url;
  const bgColor = validateHexColor((tenant?.login_bg_color as string | null) ?? null) ?? base.login_bg_color;
  const bgOverlay = validateOpacity(
    (tenant?.login_bg_overlay_opacity as number | string | null) ?? base.login_bg_overlay_opacity,
  );

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

/**
 * A verified custom domain wins, because that hostname is the partner's public portal.
 * Otherwise the signed-in partner, or a client of that partner, uses the partner brand
 * on the shared portal.
 */
export function resolveWhiteLabelBranding(
  base: PortalBranding,
  host: WhiteLabelSource | null,
  session: WhiteLabelSource | null,
): PortalBranding {
  const source = host ?? session;
  if (!source) return base;
  return mergeBranding(base, source.brandingConfig, source.orgName);
}
