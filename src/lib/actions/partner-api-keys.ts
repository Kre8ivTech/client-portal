"use server";

import { z } from "zod";
import { generatePartnerApiKey, hashPartnerApiKey, partnerApiKeyPrefix } from "@/lib/partner-api/keys";
import { canManagePartnerApiKeys } from "@/lib/partner-api/scope";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const nameSchema = z.string().trim().min(1).max(120);

export type PartnerApiKeySummary = {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

type Actor = {
  userId: string;
  organizationId: string;
  role: string;
  organizationType: string | null;
};

async function requireKeyManager(): Promise<{ ok: true; actor: Actor; supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();
  const row = profile as { organization_id: string | null; role: string } | null;
  if (!row?.organization_id) return { ok: false, error: "Organization not found" };

  const { data: organization } = await supabase
    .from("organizations")
    .select("type")
    .eq("id", row.organization_id)
    .maybeSingle();
  const organizationType = (organization as { type: string | null } | null)?.type ?? null;
  if (!canManagePartnerApiKeys({ role: row.role, organizationType })) {
    return { ok: false, error: "You cannot manage partner API keys for this organization" };
  }

  return {
    ok: true,
    supabase,
    actor: {
      userId: user.id,
      organizationId: row.organization_id,
      role: row.role,
      organizationType,
    },
  };
}

export async function listPartnerApiKeys(): Promise<{ ok: true; keys: PartnerApiKeySummary[] } | { ok: false; error: string }> {
  const access = await requireKeyManager();
  if (!access.ok) return access;

  const { data, error } = await access.supabase
    .from("partner_api_keys")
    .select("id, name, key_prefix, is_active, last_used_at, created_at, revoked_at")
    .eq("organization_id", access.actor.organizationId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: "Could not load API keys" };
  return { ok: true, keys: (data ?? []) as PartnerApiKeySummary[] };
}

export async function createPartnerApiKey(
  name: string,
): Promise<{ ok: true; apiKey: string; key: PartnerApiKeySummary } | { ok: false; error: string }> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "Enter a name for this key" };

  const access = await requireKeyManager();
  if (!access.ok) return access;

  const apiKey = generatePartnerApiKey();
  const { data, error } = await access.supabase
    .from("partner_api_keys")
    .insert({
      organization_id: access.actor.organizationId,
      created_by: access.actor.userId,
      name: parsed.data,
      key_prefix: partnerApiKeyPrefix(apiKey),
      key_hash: hashPartnerApiKey(apiKey),
    })
    .select("id, name, key_prefix, is_active, last_used_at, created_at, revoked_at")
    .single();
  if (error || !data) return { ok: false, error: "Could not create the API key" };
  return { ok: true, apiKey, key: data as PartnerApiKeySummary };
}

export async function revokePartnerApiKey(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Unknown API key" };

  const access = await requireKeyManager();
  if (!access.ok) return access;

  const { error } = await access.supabase
    .from("partner_api_keys")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("organization_id", access.actor.organizationId);
  if (error) return { ok: false, error: "Could not revoke the API key" };
  return { ok: true };
}
