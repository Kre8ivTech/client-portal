"use server";

import { z } from "zod";
import { canManagePartnerApiKeys } from "@/lib/partner-api/scope";
import {
  marketingProvider,
  mergeProviderFields,
  toPublicProviderStatus,
  type MarketingProviderId,
  type PublicProviderStatus,
} from "@/lib/marketing/providers";
import { readOrganizationProvider, saveOrganizationProvider } from "@/lib/marketing/credentials";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const fieldSchema = z.string().trim().max(500);

async function requireCredentialManager() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();
  const row = profile as { organization_id: string | null; role: string } | null;
  if (!row?.organization_id) return { ok: false as const, error: "Organization not found" };

  const { data: organization } = await supabase
    .from("organizations")
    .select("type")
    .eq("id", row.organization_id)
    .maybeSingle();
  const organizationType = (organization as { type: string | null } | null)?.type ?? null;
  if (!canManagePartnerApiKeys({ role: row.role, organizationType })) {
    return { ok: false as const, error: "You cannot save credentials for this organization" };
  }

  return {
    ok: true as const,
    userId: user.id,
    organizationId: row.organization_id,
  };
}

export async function saveMarketingCredentials(input: {
  provider: MarketingProviderId;
  fields: Record<string, string>;
}): Promise<{ ok: true; provider: PublicProviderStatus } | { ok: false; error: string }> {
  const provider = marketingProvider(input.provider);
  if (!provider) return { ok: false, error: "Unknown provider" };

  const access = await requireCredentialManager();
  if (!access.ok) return access;

  const incoming: Record<string, string> = {};
  for (const field of provider.fields) {
    const parsed = fieldSchema.safeParse(input.fields[field.key] ?? "");
    if (!parsed.success) return { ok: false, error: `Check ${field.label}` };
    incoming[field.key] = parsed.data;
  }

  let existing: Record<string, string> | null = null;
  try {
    existing = await readOrganizationProvider(access.organizationId, provider.id);
  } catch {
    return { ok: false, error: "Saved credentials could not be read. Check the encryption secret." };
  }

  const merged = mergeProviderFields(provider, incoming, existing);
  try {
    await saveOrganizationProvider(access.organizationId, provider.id, merged, access.userId);
  } catch {
    return { ok: false, error: "Could not save credentials" };
  }

  return { ok: true, provider: toPublicProviderStatus(provider, merged) };
}
