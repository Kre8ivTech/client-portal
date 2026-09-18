import { createHash } from "node:crypto";
import { z } from "zod";
import { encrypt, decrypt } from "@/lib/crypto";

export const MICROSOFT_CALENDAR_COOKIE = "microsoft-calendar-pkce";
export const MICROSOFT_CALENDAR_SCOPES = "openid profile email offline_access User.Read Calendars.ReadWrite";
export const MICROSOFT_AUTHORITY = "https://login.microsoftonline.com/organizations/oauth2/v2.0";

export function microsoftCalendarConfig() {
  return {
    clientId: process.env.MICROSOFT_CALENDAR_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/microsoft/callback`,
  };
}

export function calendarPkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function validCalendarState(state: { ts?: unknown; challenge?: unknown }, verifier?: string) {
  return typeof state.ts === "number" && Number.isFinite(state.ts)
    && state.ts <= Date.now() && Date.now() - state.ts <= 600_000
    && typeof verifier === "string" && verifier.length >= 43
    && state.challenge === calendarPkceChallenge(verifier);
}

export const microsoftCalendarTokens = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive().finite().max(604800),
  scope: z.string().refine(value => value.split(/\s+/).some(scope =>
    scope.toLowerCase().replace("https://graph.microsoft.com/", "") === "calendars.readwrite")),
});

export const microsoftCalendarProfile = z.object({
  id: z.string().min(1),
  mail: z.string().nullable().optional(),
  userPrincipalName: z.string().min(1),
});

export function encryptCalendarToken(token: string) {
  return `enc:v1:${JSON.stringify(encrypt(token))}`;
}

export function decryptCalendarToken(token: string) {
  if (!token.startsWith("enc:v1:")) throw new Error("Calendar token must be encrypted");
  const value = JSON.parse(token.slice(7));
  return decrypt(value.encryptedData, value.iv, value.authTag, value.salt);
}
