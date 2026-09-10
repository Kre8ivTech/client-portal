import { decrypt, encrypt } from "@/lib/crypto";

export type EncryptedTokenFields = {
  access_token: string | null;
  refresh_token: string | null;
  access_token_encrypted: string | null;
  access_token_iv: string | null;
  access_token_auth_tag: string | null;
  access_token_salt: string | null;
  refresh_token_encrypted: string | null;
  refresh_token_iv: string | null;
  refresh_token_auth_tag: string | null;
  refresh_token_salt: string | null;
};

export type QuickBooksTokenPair = {
  accessToken: string;
  refreshToken: string;
};

export function encryptQuickBooksTokens(tokens: QuickBooksTokenPair) {
  const access = encrypt(tokens.accessToken);
  const refresh = encrypt(tokens.refreshToken);
  return {
    access_token: null,
    refresh_token: null,
    access_token_encrypted: access.encryptedData,
    access_token_iv: access.iv,
    access_token_auth_tag: access.authTag,
    access_token_salt: access.salt,
    refresh_token_encrypted: refresh.encryptedData,
    refresh_token_iv: refresh.iv,
    refresh_token_auth_tag: refresh.authTag,
    refresh_token_salt: refresh.salt,
  };
}

export function decryptQuickBooksTokens(row: EncryptedTokenFields): QuickBooksTokenPair {
  if (
    row.access_token_encrypted &&
    row.access_token_iv &&
    row.access_token_auth_tag &&
    row.access_token_salt &&
    row.refresh_token_encrypted &&
    row.refresh_token_iv &&
    row.refresh_token_auth_tag &&
    row.refresh_token_salt
  ) {
    return {
      accessToken: decrypt(
        row.access_token_encrypted,
        row.access_token_iv,
        row.access_token_auth_tag,
        row.access_token_salt,
      ),
      refreshToken: decrypt(
        row.refresh_token_encrypted,
        row.refresh_token_iv,
        row.refresh_token_auth_tag,
        row.refresh_token_salt,
      ),
    };
  }

  if (row.access_token && row.refresh_token) {
    return {
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
    };
  }

  throw new Error("QuickBooks tokens are missing or incomplete");
}

export function toPublicQuickBooksIntegration(row: {
  id: string;
  organization_id: string;
  realm_id: string;
  is_sandbox: boolean;
  auto_sync_enabled: boolean | null;
  last_sync_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
  company_name: string | null;
  connected_at: string;
  token_expires_at: string;
}) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    realm_id: row.realm_id,
    is_sandbox: row.is_sandbox,
    auto_sync_enabled: Boolean(row.auto_sync_enabled),
    last_sync_at: row.last_sync_at,
    sync_status: row.sync_status,
    sync_error: row.sync_error,
    company_name: row.company_name,
    connected_at: row.connected_at,
    token_expires_at: row.token_expires_at,
  };
}
