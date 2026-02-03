import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { uploadObject, sanitizeS3KeyPart } from "@/lib/storage/s3";
import { buildOrgFileS3Prefix } from "@/lib/file-sync/s3-prefix";
import { listGoogleDriveFiles, downloadGoogleDriveFile, refreshGoogleAccessToken } from "@/lib/file-sync/providers/google-drive";
import { listOneDriveRootChildren, downloadOneDriveItem, refreshMicrosoftAccessToken } from "@/lib/file-sync/providers/microsoft-onedrive";
import { listDropboxFolder, downloadDropboxFile, refreshDropboxAccessToken } from "@/lib/file-sync/providers/dropbox";

const MAX_INTEGRATIONS_PER_RUN = 5;
const MAX_FILES_PER_INTEGRATION = 5;

function isTokenExpired(tokenExpiresAt: string | null | undefined): boolean {
  if (!tokenExpiresAt) return false;
  const ts = new Date(tokenExpiresAt).getTime();
  return ts < Date.now() + 60_000;
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

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // ok
  } else {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await (supabase as any).from("users").select("role").eq("id", user.id).single();
    const role = (profile as { role?: string } | null)?.role;
    if (role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: integrations, error } = await (supabaseAdmin as any)
    .from("oauth_integrations")
    .select("id, user_id, organization_id, provider, access_token, refresh_token, token_expires_at, metadata")
    .in("provider", ["google_drive", "microsoft_onedrive", "dropbox"])
    .eq("status", "active")
    .not("access_token", "is", null)
    .limit(MAX_INTEGRATIONS_PER_RUN);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<{ integration_id: string; provider: string; status: string; uploaded: number; skipped: number; error?: string }> =
    [];

  for (const integration of (integrations ?? []) as any[]) {
    const startedAt = new Date().toISOString();
    let runId: string | null = null;
    let uploaded = 0;
    let skipped = 0;

    try {
      const userId = integration.user_id as string;
      const provider = integration.provider as "google_drive" | "microsoft_onedrive" | "dropbox";

      let organizationId: string | null = integration.organization_id ?? null;
      if (!organizationId) {
        const { data: userRow } = await (supabaseAdmin as any)
          .from("users")
          .select("organization_id")
          .eq("id", userId)
          .single();
        organizationId = (userRow as any)?.organization_id ?? null;
      }

      if (!organizationId) {
        results.push({ integration_id: integration.id, provider, status: "skipped", uploaded, skipped, error: "Missing organization_id" });
        continue;
      }

      const { data: storageSettings } = await (supabaseAdmin as any)
        .from("organization_file_storage_settings")
        .select("s3_prefix, enabled")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (storageSettings?.enabled === false) {
        results.push({ integration_id: integration.id, provider, status: "skipped", uploaded, skipped, error: "Storage disabled" });
        continue;
      }

      // Create run record
      const runInsert = await (supabaseAdmin as any)
        .from("file_sync_runs")
        .insert({
          organization_id: organizationId,
          user_id: userId,
          provider,
          status: "running",
          started_at: startedAt,
        })
        .select("id")
        .single();
      runId = runInsert?.data?.id ?? null;

      let accessToken: string = integration.access_token;
      const refreshToken: string | null = integration.refresh_token ?? null;

      if (isTokenExpired(integration.token_expires_at) && refreshToken) {
        if (provider === "google_drive") {
          const clientId = process.env.GOOGLE_CLIENT_ID;
          const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
          if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");
          const refreshed = await refreshGoogleAccessToken({ clientId, clientSecret, refreshToken });
          accessToken = refreshed.accessToken;
          await (supabaseAdmin as any)
            .from("oauth_integrations")
            .update({
              access_token: refreshed.accessToken,
              refresh_token: refreshed.refreshToken ?? refreshToken,
              token_expires_at: new Date(Date.now() + refreshed.expiresInSeconds * 1000).toISOString(),
              status: "active",
            })
            .eq("id", integration.id);
        } else if (provider === "microsoft_onedrive") {
          const clientId = process.env.MICROSOFT_CLIENT_ID;
          const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
          const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/file-integrations/microsoft-onedrive/callback`;
          if (!clientId || !clientSecret) throw new Error("Microsoft OAuth is not configured");
          const refreshed = await refreshMicrosoftAccessToken({ clientId, clientSecret, refreshToken, redirectUri });
          accessToken = refreshed.accessToken;
          await (supabaseAdmin as any)
            .from("oauth_integrations")
            .update({
              access_token: refreshed.accessToken,
              refresh_token: refreshed.refreshToken ?? refreshToken,
              token_expires_at: new Date(Date.now() + refreshed.expiresInSeconds * 1000).toISOString(),
              status: "active",
            })
            .eq("id", integration.id);
        } else if (provider === "dropbox") {
          const clientId = process.env.DROPBOX_CLIENT_ID;
          const clientSecret = process.env.DROPBOX_CLIENT_SECRET;
          if (!clientId || !clientSecret) throw new Error("Dropbox OAuth is not configured");
          const refreshed = await refreshDropboxAccessToken({ clientId, clientSecret, refreshToken });
          accessToken = refreshed.accessToken;
          await (supabaseAdmin as any)
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

      const overridePrefix = (storageSettings?.s3_prefix as string | null | undefined) ?? null;
      const s3Prefix = buildOrgFileS3Prefix({ organizationId, provider, userId, overridePrefix });
      const nowIso = new Date().toISOString();

      if (provider === "google_drive") {
        const state = (integration.metadata && (integration.metadata as any).file_sync?.google_drive) || {};
        const pageToken = (state as any).pageToken as string | undefined;
        const listed = await listGoogleDriveFiles({ accessToken, pageToken, pageSize: 20 });

        for (const f of listed.files) {
          if (uploaded >= MAX_FILES_PER_INTEGRATION) break;
          if (f.mimeType === "application/vnd.google-apps.folder" || f.mimeType.startsWith("application/vnd.google-apps")) {
            skipped += 1;
            continue;
          }
          const downloaded = await downloadGoogleDriveFile({ accessToken, fileId: f.id });
          const safeName = sanitizeS3KeyPart(f.name) || `file-${f.id}`;
          const key = `${s3Prefix}/${f.id}/${safeName}`;
          const uploadedRes = await uploadObject({
            key,
            body: downloaded.body,
            contentType: downloaded.contentType || f.mimeType,
            metadata: { organizationId, userId, provider, sourceFileId: f.id },
          });

          await (supabaseAdmin as any).from("organization_files").upsert(
            {
              organization_id: organizationId,
              owner_user_id: userId,
              oauth_integration_id: integration.id,
              source_provider: provider,
              source_file_id: f.id,
              source_path: "root",
              name: f.name,
              mime_type: f.mimeType,
              size_bytes: f.size ? Number(f.size) : null,
              s3_bucket: uploadedRes.bucket,
              s3_key: uploadedRes.key,
              external_modified_at: f.modifiedTime ?? null,
              synced_at: nowIso,
            },
            { onConflict: "organization_id,source_provider,source_file_id" }
          );
          uploaded += 1;
        }

        await (supabaseAdmin as any)
          .from("oauth_integrations")
          .update({
            metadata: setFileSyncState(integration.metadata, provider, { pageToken: listed.nextPageToken ?? null }),
            last_sync_at: nowIso,
            status: "active",
          })
          .eq("id", integration.id);
      } else if (provider === "microsoft_onedrive") {
        const state = (integration.metadata && (integration.metadata as any).file_sync?.microsoft_onedrive) || {};
        const nextLink = (state as any).nextLink as string | undefined;
        const listed = await listOneDriveRootChildren({ accessToken, nextLink, top: 20 });

        for (const item of listed.items) {
          if (uploaded >= MAX_FILES_PER_INTEGRATION) break;
          if (item.folder || !item.file) {
            skipped += 1;
            continue;
          }
          const downloaded = await downloadOneDriveItem({ accessToken, item });
          const safeName = sanitizeS3KeyPart(item.name) || `file-${item.id}`;
          const key = `${s3Prefix}/${item.id}/${safeName}`;
          const uploadedRes = await uploadObject({
            key,
            body: downloaded.body,
            contentType: downloaded.contentType || item.file.mimeType,
            metadata: { organizationId, userId, provider, sourceFileId: item.id },
          });

          await (supabaseAdmin as any).from("organization_files").upsert(
            {
              organization_id: organizationId,
              owner_user_id: userId,
              oauth_integration_id: integration.id,
              source_provider: provider,
              source_file_id: item.id,
              source_path: item.parentReference?.path ?? "root",
              name: item.name,
              mime_type: item.file.mimeType ?? null,
              size_bytes: typeof item.size === "number" ? item.size : null,
              s3_bucket: uploadedRes.bucket,
              s3_key: uploadedRes.key,
              external_modified_at: item.lastModifiedDateTime ?? null,
              synced_at: nowIso,
            },
            { onConflict: "organization_id,source_provider,source_file_id" }
          );
          uploaded += 1;
        }

        await (supabaseAdmin as any)
          .from("oauth_integrations")
          .update({
            metadata: setFileSyncState(integration.metadata, provider, { nextLink: listed.nextLink ?? null }),
            last_sync_at: nowIso,
            status: "active",
          })
          .eq("id", integration.id);
      } else if (provider === "dropbox") {
        const state = (integration.metadata && (integration.metadata as any).file_sync?.dropbox) || {};
        const cursor = (state as any).cursor as string | undefined;
        const listed = await listDropboxFolder({ accessToken, cursor, path: "", limit: 20 });

        for (const entry of listed.entries) {
          if (uploaded >= MAX_FILES_PER_INTEGRATION) break;
          if (entry[".tag"] !== "file" || !entry.path_lower) {
            skipped += 1;
            continue;
          }
          const downloaded = await downloadDropboxFile({ accessToken, pathLower: entry.path_lower });
          const safeName = sanitizeS3KeyPart(entry.name) || `file-${entry.id}`;
          const key = `${s3Prefix}/${sanitizeS3KeyPart(entry.id)}/${safeName}`;
          const uploadedRes = await uploadObject({
            key,
            body: downloaded.body,
            contentType: downloaded.contentType,
            metadata: { organizationId, userId, provider, sourceFileId: entry.id },
          });

          await (supabaseAdmin as any).from("organization_files").upsert(
            {
              organization_id: organizationId,
              owner_user_id: userId,
              oauth_integration_id: integration.id,
              source_provider: provider,
              source_file_id: entry.id,
              source_path: entry.path_display ?? entry.path_lower ?? null,
              name: entry.name,
              mime_type: downloaded.contentType ?? null,
              size_bytes: typeof entry.size === "number" ? entry.size : null,
              s3_bucket: uploadedRes.bucket,
              s3_key: uploadedRes.key,
              external_modified_at: entry.server_modified ?? null,
              synced_at: nowIso,
            },
            { onConflict: "organization_id,source_provider,source_file_id" }
          );
          uploaded += 1;
        }

        await (supabaseAdmin as any)
          .from("oauth_integrations")
          .update({
            metadata: setFileSyncState(integration.metadata, provider, { cursor: listed.cursor ?? null, hasMore: listed.hasMore }),
            last_sync_at: nowIso,
            status: "active",
          })
          .eq("id", integration.id);
      }

      if (runId) {
        await (supabaseAdmin as any)
          .from("file_sync_runs")
          .update({ status: "success", finished_at: new Date().toISOString(), stats: { uploaded, skipped } })
          .eq("id", runId);
      }

      results.push({ integration_id: integration.id, provider, status: "success", uploaded, skipped });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (runId) {
        await (supabaseAdmin as any)
          .from("file_sync_runs")
          .update({ status: "error", finished_at: new Date().toISOString(), error: msg, stats: { uploaded, skipped } })
          .eq("id", runId);
      }
      results.push({ integration_id: integration.id, provider: integration.provider, status: "error", uploaded, skipped, error: msg });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

