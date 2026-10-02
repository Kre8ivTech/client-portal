import { createHash, randomBytes } from "crypto";

const KEY_PREFIX = "ktp";

export function generatePartnerApiKey(): string {
  return `${KEY_PREFIX}_${randomBytes(32).toString("base64url")}`;
}

export function hashPartnerApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function partnerApiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 12);
}

export function readBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  const token = match?.[1]?.trim();
  if (!token || !token.startsWith(`${KEY_PREFIX}_`)) return null;
  return token;
}
