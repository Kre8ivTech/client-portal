import { decrypt, encrypt } from "@/lib/crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  MARKETING_PROVIDERS,
  marketingProvider,
  providerHasValues,
  resolveGoogleAdsCredentialSet,
  toPublicProviderStatus,
  type MarketingProviderId,
  type PublicProviderStatus,
} from "@/lib/marketing/providers";

type CredentialRow = {
  provider: string;
  encrypted_data: string;
  iv: string;
  auth_tag: string;
  salt: string;
  public_fields: Record<string, unknown> | null;
};

function parseStored(row: CredentialRow): Record<string, string> {
  const json = decrypt(row.encrypted_data, row.iv, row.auth_tag, row.salt);
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

export async function readOrganizationProvider(
  organizationId: string,
  providerId: MarketingProviderId,
): Promise<Record<string, string> | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("organization_provider_credentials")
    .select("provider, encrypted_data, iv, auth_tag, salt, public_fields")
    .eq("organization_id", organizationId)
    .eq("provider", providerId)
    .maybeSingle();
  if (error || !data) return null;
  return parseStored(data as CredentialRow);
}

export async function listOrganizationProviderStatus(organizationId: string): Promise<PublicProviderStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("organization_provider_credentials")
    .select("provider, encrypted_data, iv, auth_tag, salt, public_fields")
    .eq("organization_id", organizationId);
  const rows = error ? [] : ((data ?? []) as CredentialRow[]);
  const byProvider = new Map<string, Record<string, string>>();
  for (const row of rows) {
    try {
      byProvider.set(row.provider, parseStored(row));
    } catch {
      byProvider.set(row.provider, {});
    }
  }
  return MARKETING_PROVIDERS.map((provider) => toPublicProviderStatus(provider, byProvider.get(provider.id) ?? null));
}

export async function saveOrganizationProvider(
  organizationId: string,
  providerId: MarketingProviderId,
  values: Record<string, string>,
  updatedBy: string,
): Promise<void> {
  const provider = marketingProvider(providerId);
  if (!provider) throw new Error("Unknown provider");
  const admin = getSupabaseAdmin();

  if (!providerHasValues(values)) {
    await admin
      .from("organization_provider_credentials")
      .delete()
      .eq("organization_id", organizationId)
      .eq("provider", providerId);
    return;
  }

  const encrypted = encrypt(JSON.stringify(values));
  const publicFields: Record<string, boolean> = {};
  for (const field of provider.fields) {
    publicFields[`${field.key}_set`] = Boolean(values[field.key]?.trim());
  }

  const { error } = await admin.from("organization_provider_credentials").upsert(
    {
      organization_id: organizationId,
      provider: providerId,
      encrypted_data: encrypted.encryptedData,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
      salt: encrypted.salt,
      public_fields: publicFields,
      updated_by: updatedBy,
    },
    { onConflict: "organization_id,provider" },
  );
  if (error) throw new Error("Could not save provider credentials");
}

export async function loadGoogleAdsOAuthForOrganization(organizationId: string) {
  let stored: Record<string, string> | null = null;
  try {
    stored = await readOrganizationProvider(organizationId, "google_ads");
  } catch {
    stored = null;
  }
  const resolved = resolveGoogleAdsCredentialSet({
    stored,
    envClientId: process.env.GOOGLE_CLIENT_ID,
    envClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    envDeveloperToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });
  if (!resolved) throw new Error("Google Ads OAuth is not configured");
  return resolved;
}

export async function loadGoogleOAuthClientForOrganization(organizationId: string | null) {
  let stored: Record<string, string> | null = null;
  if (organizationId) {
    try {
      stored = await readOrganizationProvider(organizationId, "google_oauth");
    } catch {
      stored = null;
    }
  }
  const storedId = stored?.client_id?.trim() ?? "";
  const storedSecret = stored?.client_secret?.trim() ?? "";
  if (storedId && storedSecret) return { clientId: storedId, clientSecret: storedSecret };
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  if (!storedId && !storedSecret && clientId && clientSecret) return { clientId, clientSecret };
  return null;
}
