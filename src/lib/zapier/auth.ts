import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest } from "next/server";
import crypto from "crypto";

export interface ApiKeyContext {
  userId: string;
  organizationId: string;
  scopes: string[];
}

/**
 * Verify API key from request headers
 */
export async function verifyApiKey(
  request: NextRequest
): Promise<ApiKeyContext | null> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

  if (!apiKey) {
    return null;
  }

  // Hash the provided key
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  // Look up the key in the database using admin client (bypasses RLS)
  const { data: apiKeyData, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, organization_id, scopes, is_active, expires_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !apiKeyData) {
    return null;
  }

  // Check if key is active
  if (!apiKeyData.is_active) {
    return null;
  }

  // Check if key is expired
  if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
    return null;
  }

  // Update last_used_at timestamp (fire and forget)
  supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKeyData.id)
    .then(() => {});

  return {
    userId: apiKeyData.user_id,
    organizationId: apiKeyData.organization_id,
    scopes: apiKeyData.scopes || [],
  };
}

/**
 * Check if API key has required scope
 */
export function hasScope(context: ApiKeyContext, requiredScope: string): boolean {
  return context.scopes.includes(requiredScope) || context.scopes.includes("*");
}

/**
 * Generate a new API key
 */
export function generateApiKey(prefix: string = "kt_live"): string {
  const randomBytes = crypto.randomBytes(32);
  const keyValue = randomBytes.toString("hex");
  return `${prefix}_${keyValue}`;
}

/**
 * Hash an API key for storage
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}
