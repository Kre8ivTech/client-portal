import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { uploadObject, sanitizeS3KeyPart } from "@/lib/storage/s3";
import { buildOrgFileS3Prefix } from "@/lib/file-sync/s3-prefix";
import { listGoogleDriveFiles, downloadGoogleDriveFile, refreshGoogleAccessToken } from "@/lib/file-sync/providers/google-drive";
import { listOneDriveRootChildren, downloadOneDriveItem, refreshMicrosoftAccessToken } from "@/lib/file-sync/providers/microsoft-onedrive";
import { listDropboxFolder, downloadDropboxFile, refreshDropboxAccessToken } from "@/lib/file-sync/providers/dropbox";

const bodySchema = z.object({
  provider: z.enum(["google_drive", "microsoft_onedrive", "dropbox"]),
});

const MAX_FILES_PER_RUN = 10;

function isTokenExpired(tokenExpiresAt: string | null | undefined): boolean {
  if (!tokenExpiresAt) return false;
  const ts = new Date(tokenExpiresAt).getTime();
  // refresh 60s early
  return ts < Date.now() + 60_000;
}

function getProviderAuthConfig(provider: "google_drive" | "microsoft_onedrive" | "dropbox") {
  if (provider === "google_drive") {
    return {
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    } as const;
  }
  if (provider === "microsoft_onedrive") {
    return {
      microsoftClientId: process.env.MICROSOFT_CLIENT_ID,
      microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      microsoftRedirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/file-integrations/microsoft-onedrive/callback`,
    } as const;
  }
  return {
    dropboxClientId: process.env.DROPBOX_CLIENT_ID,
    dropboxClientSecret: process.env.DROPBOX_CLIENT_SECRET,
  } as const;
}

function setFileSyncState(metadata: unknown, provider: string, state: Record<string, unknown>) {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
  const fileSync =
    base.file_sync && typeof base.file_sync === "object" && !Array.isArray(base.file_sync)
      ? (base.file_sync as Record<string, unknown>)
      : {};
  return { ...base, file_sync: { ...fileSync, [provider]: state } };
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const provider = parsed.data.provider;

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (userErr || !(userRow as any)?.organization_id) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }
  const organizationId = (userRow as any).organization_id as string;

  const db = supabase as unknown as {
    from: (table: string) => any;
  };

  // Destination settings (org-scoped) - optional but must not be disabled
  const storageSettings = await db
    .from("organization_file_storage_settings")
    .select("s3_prefix, enabled")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (storageSettings?.data && storageSettings.data.enabled === false) {
    return NextResponse.json({ error: "File storage is disabled for this organization" }, { status: 403 });
  }

  // Load provider integration
  const integrationRes = await supabase
    .from("oauth_integrations")
    .select("id, provider, access_token, refresh_token, token_expires_at, metadata")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .maybeSingle();

  const integration = integrationRes.data as any | null;
  if (!integration?.access_token) {
    return NextResponse.json({ error: "Provider not connected" }, { status: 400 });
  }

  // Create a sync run record (auditable)
  const startedAt = new Date().toISOString();
  const runInsert = await db
    .from("file_sync_runs")
    .insert({
      organization_id: organizationId,
      user_id: user.id,
      provider,
      status: "running",
      started_at: startedAt,
    })
    .select("id")
    .single();

  const runId = runInsert?.data?.id as string | undefined;

  const stats: Record<string, unknown> = {
    provider,
    uploaded: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    let accessToken = integration.access_token as string;
    const refreshToken = integration.refresh_token as string | null | undefined;

    // Refresh token if needed
    if (isTokenExpired(integration.token_expires_at) && refreshToken) {
      if (provider === "google_drive") {
        const cfg = getProviderAuthConfig(provider);
        if (!cfg.googleClientId || !cfg.googleClientSecret) throw new Error("Google OAuth is not configured");
        const refreshed = await refreshGoogleAccessToken({
          clientId: cfg.googleClientId,
          clientSecret: cfg.googleClientSecret,
          refreshToken,
        });
        accessToken = refreshed.accessToken;

        await db
          .from("oauth_integrations")
          .update({
            access_token: refreshed.accessToken,
            refresh_token: refreshed.refreshToken ?? refreshToken,
            token_expires_at: new Date(Date.now() + refreshed.expiresInSeconds * 1000).toISOString(),
            status: "active",
          })
          .eq("id", integration.id);
      } else if (provider === "microsoft_onedrive") {
        const cfg = getProviderAuthConfig(provider);
        if (!cfg.microsoftClientId || !cfg.microsoftClientSecret || !cfg.microsoftRedirectUri) {
          throw new Error("Microsoft OAuth is not configured");
        }
        const refreshed = await refreshMicrosoftAccessToken({
          clientId: cfg.microsoftClientId,
          clientSecret: cfg.microsoftClientSecret,
          refreshToken,
          redirectUri: cfg.microsoftRedirectUri,
        });
        accessToken = refreshed.accessToken;
        await db
          .from("oauth_integrations")
          .update({
            access_token: refreshed.accessToken,
            refresh_token: refreshed.refreshToken ?? refreshToken,
            token_expires_at: new Date(Date.now() + refreshed.expiresInSeconds * 1000).toISOString(),
            scopes: refreshed.scope?.split(" ") ?? undefined,
            status: "active",
          })
          .eq("id", integration.id);
      } else if (provider === "dropbox") {
        const cfg = getProviderAuthConfig(provider);
        if (!cfg.dropboxClientId || !cfg.dropboxClientSecret) throw new Error("Dropbox OAuth is not configured");
        const refreshed = await refreshDropboxAccessToken({
          clientId: cfg.dropboxClientId,
          clientSecret: cfg.dropboxClientSecret,
          refreshToken,
        });
        accessToken = refreshed.accessToken;
        await db
          .from("oauth_integrations")
          .update({
            access_token: refreshed.accessToken,
            token_expires_at: refreshed.expiresInSeconds
              ? new Date(Date.now() + refreshed.expiresInSeconds * 1000).toISOString()
              : null,
            status: "active",
          })
          .eq("id", integration.id);
      }
    }

    const overridePrefix = storageSettings?.data?.s3_prefix as string | null | undefined;
    const s3Prefix = buildOrgFileS3Prefix({ organizationId, provider, userId: user.id, overridePrefix });

    const nowIso = new Date().toISOString();

    if (provider === "google_drive") {
      const meta = integration.metadata as unknown;
      const state = (meta && typeof meta === "object" && (meta as any).file_sync?.google_drive) || {};
      const pageToken = (state as any).pageToken as string | undefined;

      const listed = await listGoogleDriveFiles({ accessToken, pageToken, pageSize: 20 });
      let processed = 0;

      for (const f of listed.files) {
        if (processed >= MAX_FILES_PER_RUN) break;
        if (f.mimeType === "application/vnd.google-apps.folder" || f.mimeType.startsWith("application/vnd.google-apps")) {
          stats.skipped = Number(stats.skipped) + 1;
          continue;
        }

        const downloaded = await downloadGoogleDriveFile({ accessToken, fileId: f.id });
        const safeName = sanitizeS3KeyPart(f.name) || `file-${f.id}`;
        const key = `${s3Prefix}/${f.id}/${safeName}`;

        const uploaded = await uploadObject({
          key,
          body: downloaded.body,
          contentType: downloaded.contentType || f.mimeType,
          metadata: { organizationId, userId: user.id, provider, sourceFileId: f.id },
        });

        await db.from("organization_files").upsert(
          {
            organization_id: organizationId,
            owner_user_id: user.id,
            oauth_integration_id: integration.id,
            source_provider: provider,
            source_file_id: f.id,
            source_path: "root",
            name: f.name,
            mime_type: f.mimeType,
            size_bytes: f.size ? Number(f.size) : null,
            s3_bucket: uploaded.bucket,
            s3_key: uploaded.key,
            external_modified_at: f.modifiedTime ?? null,
            synced_at: nowIso,
          },
          { onConflict: "organization_id,source_provider,source_file_id" }
        );

        stats.uploaded = Number(stats.uploaded) + 1;
        processed += 1;
      }

      await db
        .from("oauth_integrations")
        .update({
          metadata: setFileSyncState(integration.metadata, provider, { pageToken: listed.nextPageToken ?? null }),
          last_sync_at: nowIso,
          status: "active",
        })
        .eq("id", integration.id);
    } else if (provider === "microsoft_onedrive") {
      const meta = integration.metadata as unknown;
      const state = (meta && typeof meta === "object" && (meta as any).file_sync?.microsoft_onedrive) || {};
      const nextLink = (state as any).nextLink as string | undefined;

      const listed = await listOneDriveRootChildren({ accessToken, nextLink, top: 20 });
      let processed = 0;

      for (const item of listed.items) {
        if (processed >= MAX_FILES_PER_RUN) break;
        if (item.folder) {
          stats.skipped = Number(stats.skipped) + 1;
          continue;
        }
        if (!item.file) {
          stats.skipped = Number(stats.skipped) + 1;
          continue;
        }

        const downloaded = await downloadOneDriveItem({ accessToken, item });
        const safeName = sanitizeS3KeyPart(item.name) || `file-${item.id}`;
        const key = `${s3Prefix}/${item.id}/${safeName}`;

        const uploaded = await uploadObject({
          key,
          body: downloaded.body,
          contentType: downloaded.contentType || item.file.mimeType,
          metadata: { organizationId, userId: user.id, provider, sourceFileId: item.id },
        });

        await db.from("organization_files").upsert(
          {
            organization_id: organizationId,
            owner_user_id: user.id,
            oauth_integration_id: integration.id,
            source_provider: provider,
            source_file_id: item.id,
            source_path: item.parentReference?.path ?? "root",
            name: item.name,
            mime_type: item.file.mimeType ?? null,
            size_bytes: typeof item.size === "number" ? item.size : null,
            s3_bucket: uploaded.bucket,
            s3_key: uploaded.key,
            external_modified_at: item.lastModifiedDateTime ?? null,
            synced_at: nowIso,
          },
          { onConflict: "organization_id,source_provider,source_file_id" }
        );

        stats.uploaded = Number(stats.uploaded) + 1;
        processed += 1;
      }

      await db
        .from("oauth_integrations")
        .update({
          metadata: setFileSyncState(integration.metadata, provider, { nextLink: listed.nextLink ?? null }),
          last_sync_at: nowIso,
          status: "active",
        })
        .eq("id", integration.id);
    } else if (provider === "dropbox") {
      const meta = integration.metadata as unknown;
      const state = (meta && typeof meta === "object" && (meta as any).file_sync?.dropbox) || {};
      const cursor = (state as any).cursor as string | undefined;

      const listed = await listDropboxFolder({ accessToken, cursor, path: "", limit: 20 });
      let processed = 0;

      for (const entry of listed.entries) {
        if (processed >= MAX_FILES_PER_RUN) break;
        if (entry[".tag"] !== "file" || !entry.path_lower) {
          stats.skipped = Number(stats.skipped) + 1;
          continue;
        }

        const downloaded = await downloadDropboxFile({ accessToken, pathLower: entry.path_lower });
        const safeName = sanitizeS3KeyPart(entry.name) || `file-${entry.id}`;
        const key = `${s3Prefix}/${sanitizeS3KeyPart(entry.id)}/${safeName}`;

        const uploaded = await uploadObject({
          key,
          body: downloaded.body,
          contentType: downloaded.contentType,
          metadata: { organizationId, userId: user.id, provider, sourceFileId: entry.id },
        });

        await db.from("organization_files").upsert(
          {
            organization_id: organizationId,
            owner_user_id: user.id,
            oauth_integration_id: integration.id,
            source_provider: provider,
            source_file_id: entry.id,
            source_path: entry.path_display ?? entry.path_lower ?? null,
            name: entry.name,
            mime_type: downloaded.contentType ?? null,
            size_bytes: typeof entry.size === "number" ? entry.size : null,
            s3_bucket: uploaded.bucket,
            s3_key: uploaded.key,
            external_modified_at: entry.server_modified ?? null,
            synced_at: nowIso,
          },
          { onConflict: "organization_id,source_provider,source_file_id" }
        );

        stats.uploaded = Number(stats.uploaded) + 1;
        processed += 1;
      }

      await db
        .from("oauth_integrations")
        .update({
          metadata: setFileSyncState(integration.metadata, provider, {
            cursor: listed.cursor ?? null,
            hasMore: listed.hasMore,
          }),
          last_sync_at: nowIso,
          status: "active",
        })
        .eq("id", integration.id);
    }

    const finishedAt = new Date().toISOString();
    if (runId) {
      await db
        .from("file_sync_runs")
        .update({ status: "success", finished_at: finishedAt, stats })
        .eq("id", runId);
    }

    return NextResponse.json({ success: true, data: { run_id: runId, stats } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    stats.errors = Number(stats.errors) + 1;
    if (runId) {
      await db
        .from("file_sync_runs")
        .update({ status: "error", finished_at: new Date().toISOString(), error: msg, stats })
        .eq("id", runId);
    }
    return NextResponse.json({ error: "Sync failed", details: msg, run_id: runId }, { status: 500 });
  }
}

