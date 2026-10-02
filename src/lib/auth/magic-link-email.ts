import { escapeHtml, validateImageUrl } from "@/lib/security";
import type { PortalBranding } from "@/lib/white-label/resolve-branding";

export type MagicLinkEmailBranding = Pick<
  PortalBranding,
  "app_name" | "tagline" | "logo_url" | "primary_color"
>;

export type MagicLinkEmail = {
  subject: string;
  html: string;
  text: string;
  fromName: string;
};

function plain(value: string | null | undefined, fallback: string, max = 120): string {
  const cleaned = (value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || fallback).slice(0, max);
}

function httpsUrl(value: string | null | undefined): string | null {
  const validated = validateImageUrl(value);
  if (!validated) return null;
  try {
    const url = new URL(validated);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeMagicLink(value: string): string | null {
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.username || url.password) return null;
    if (url.protocol === "https:") return url.toString();
    if (url.protocol === "http:" && local) return url.toString();
    return null;
  } catch {
    return null;
  }
}

function encodeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const lig = Math.min(100, Math.max(0, l)) / 100;
  const chroma = (1 - Math.abs(2 * lig - 1)) * sat;
  const hue = (((h % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((hue % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;
  if (hue < 1) [red, green, blue] = [chroma, x, 0];
  else if (hue < 2) [red, green, blue] = [x, chroma, 0];
  else if (hue < 3) [red, green, blue] = [0, chroma, x];
  else if (hue < 4) [red, green, blue] = [0, x, chroma];
  else if (hue < 5) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];
  const match = lig - chroma / 2;
  const channel = (value: number) =>
    Math.round((value + match) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

export function brandingColorToHex(color: string | null | undefined): string {
  const fallback = "#334155";
  if (!color) return fallback;
  const trimmed = color.trim();
  const hex = trimmed.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) return `#${hex[1].toLowerCase()}`;
  const hsl = trimmed.match(/^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/);
  if (!hsl) return fallback;
  return hslToHex(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]));
}

function buttonTextColor(hex: string): string {
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.7 ? "#111827" : "#ffffff";
}

export function buildMagicLinkEmail(input: {
  branding: MagicLinkEmailBranding;
  magicLink: string;
}): MagicLinkEmail | null {
  const magicLink = safeMagicLink(input.magicLink);
  if (!magicLink) return null;

  const appName = plain(input.branding.app_name, "Portal");
  const tagline = input.branding.tagline ? plain(input.branding.tagline, "", 160) : "";
  const shortLine = tagline || "Use the button below to sign in. This link expires soon.";
  const logoUrl = httpsUrl(input.branding.logo_url);
  const buttonColor = brandingColorToHex(input.branding.primary_color);
  const buttonText = buttonTextColor(buttonColor);
  const safeName = escapeHtml(appName);
  const safeLine = escapeHtml(shortLine);
  const safeLink = encodeAttr(magicLink);
  const logo = logoUrl
    ? `<img src="${encodeAttr(logoUrl)}" alt="${safeName}" width="180" style="display:block;margin:0 auto 16px;max-width:180px;height:auto;border:0;" />`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f4f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px 28px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
            <tr>
              <td align="center">
                ${logo}
                <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;">${safeName}</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#3f3f46;">${safeLine}</p>
                <a href="${safeLink}" style="display:inline-block;background:${buttonColor};color:${buttonText};text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Sign in</a>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#52525b;">If the button does not work, copy this link into your browser:<br /><a href="${safeLink}" style="color:${buttonColor};word-break:break-all;">${safeLink}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Sign in to ${appName}`,
    "",
    shortLine,
    "",
    magicLink,
    "",
    "If you did not request this email, you can ignore it.",
  ].join("\n");

  return {
    subject: `Sign in to ${appName}`,
    html,
    text,
    fromName: appName,
  };
}
