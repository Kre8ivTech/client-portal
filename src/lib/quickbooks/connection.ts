import { getQuickBooksConfig, QuickBooksClient } from "@/lib/quickbooks/client";
import {
  decryptQuickBooksTokens,
  encryptQuickBooksTokens,
  type EncryptedTokenFields,
} from "@/lib/quickbooks/tokens";

export const QUICKBOOKS_SAFE_SELECT =
  "id, organization_id, realm_id, is_sandbox, auto_sync_enabled, last_sync_at, sync_status, sync_error, company_name, connected_at, token_expires_at";

export const QUICKBOOKS_TOKEN_SELECT =
  QUICKBOOKS_SAFE_SELECT +
  ", access_token, refresh_token, access_token_encrypted, access_token_iv, access_token_auth_tag, access_token_salt, refresh_token_encrypted, refresh_token_iv, refresh_token_auth_tag, refresh_token_salt, refresh_token_expires_at";

export type QuickBooksIntegrationRow = EncryptedTokenFields & {
  id: string;
  organization_id: string;
  realm_id: string;
  token_expires_at: string;
  refresh_token_expires_at: string | null;
  is_sandbox: boolean;
  auto_sync_enabled: boolean | null;
  last_sync_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
  company_name: string | null;
  connected_at: string;
};

type QueryClient = {
  from: (table: string) => {
    select: (columns: string) => Record<string, unknown>;
    update: (values: Record<string, unknown>) => Record<string, unknown>;
  };
  rpc?: (fn: string, args: Record<string, unknown>) => unknown;
};

export async function getConnectedQuickBooksClient(
  supabase: QueryClient,
  organizationId: string,
): Promise<{
  client: QuickBooksClient;
  integration: QuickBooksIntegrationRow;
  accessToken: string;
}> {
  const query = supabase.from("quickbooks_integrations").select(QUICKBOOKS_TOKEN_SELECT) as {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{ data: QuickBooksIntegrationRow | null; error: { message: string } | null }>;
    };
  };
  const { data: integration, error } = await query.eq("organization_id", organizationId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!integration) {
    throw new Error("QuickBooks not connected for this organization");
  }

  let tokens = decryptQuickBooksTokens(integration);
  const config = await getQuickBooksConfig(supabase, organizationId);
  const expiresAt = new Date(integration.token_expires_at);
  const refreshSoon = expiresAt.getTime() - Date.now() < 60 * 1000;

  if (refreshSoon) {
    const refreshed = await QuickBooksClient.refreshToken(config, tokens.refreshToken);
    const encrypted = encryptQuickBooksTokens({
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
    });
    const tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    const refreshExpiresAt = refreshed.x_refresh_token_expires_in
      ? new Date(Date.now() + refreshed.x_refresh_token_expires_in * 1000).toISOString()
      : integration.refresh_token_expires_at;

    const updateQuery = supabase.from("quickbooks_integrations").update({
      ...encrypted,
      token_expires_at: tokenExpiresAt,
      refresh_token_expires_at: refreshExpiresAt,
    }) as { eq: (column: string, value: string) => Promise<unknown> };
    await updateQuery.eq("id", integration.id);

    tokens = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
    };
    integration.token_expires_at = tokenExpiresAt;
  }

  return {
    client: new QuickBooksClient(config, integration.realm_id, tokens.accessToken),
    integration,
    accessToken: tokens.accessToken,
  };
}

export function billedCustomerName(invoice: {
  client?: { email?: string | null; profiles?: { name?: string | null } | { name?: string | null }[] | null } | null;
  metadata?: { billed_organization_name?: string; client_id?: string } | null;
  organization?: { name?: string | null } | null;
}): string {
  const profile = invoice.client?.profiles;
  const profileName = Array.isArray(profile) ? profile[0]?.name : profile?.name;
  return (
    invoice.metadata?.billed_organization_name?.trim() ||
    profileName?.trim() ||
    invoice.client?.email?.trim() ||
    invoice.organization?.name?.trim() ||
    "Portal Customer"
  );
}
