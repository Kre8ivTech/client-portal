import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDrive } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { FileStorageSettings } from "@/components/settings/file-storage-settings";

const APP_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

type IntegrationRow = {
  id: string;
  provider: string;
  provider_email: string | null;
  status: string;
  last_sync_at: string | null;
};

type StorageSettingsRow = {
  s3_prefix: string | null;
  enabled: boolean;
} | null;

type SyncRunRow = {
  id: string;
  provider: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  error: string | null;
  stats: unknown;
};

export default async function FileStorageSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userRow } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  const role = (userRow as { role?: string } | null)?.role ?? "client";
  const organizationId = (userRow as { organization_id?: string | null } | null)?.organization_id ?? null;

  if (!organizationId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">File Storage</h1>
          <p className="text-muted-foreground">Connect external storage and sync into secure S3 storage.</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No organization found. You need an organization to configure file storage.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const providerList = ["google_drive", "microsoft_onedrive", "dropbox"];

  const { data: integrations } = await supabase
    .from("oauth_integrations")
    .select("id, provider, provider_email, status, last_sync_at")
    .eq("user_id", user.id)
    .in("provider", providerList);

  const db = supabase as unknown as { from: (table: string) => any };
  const storageSettingsRes = await db
    .from("organization_file_storage_settings")
    .select("s3_prefix, enabled")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const syncRunsRes = await db
    .from("file_sync_runs")
    .select("id, provider, status, created_at, finished_at, error, stats")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const awsEnvConfigured = !!process.env.AWS_S3_BUCKET_NAME && !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
  const admin = getSupabaseAdmin();
  const { data: appRow } = await (admin as any)
    .from("app_settings")
    .select("aws_s3_config_encrypted")
    .eq("id", APP_SETTINGS_ID)
    .single();
  const hasEncryptedS3 = !!appRow?.aws_s3_config_encrypted;
  const { data: s3DbRow } = await db
    .from("aws_s3_config")
    .select("id")
    .is("organization_id", null)
    .maybeSingle();
  const awsConfigured = awsEnvConfigured || hasEncryptedS3 || !!s3DbRow;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">File Storage</h1>
        <p className="text-muted-foreground">
          Connect Google Drive, OneDrive, or Dropbox and sync files into your organization’s secure S3 storage.
        </p>
      </div>

      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <HardDrive className="text-primary w-5 h-5" />
            Connections & Sync
          </CardTitle>
          <CardDescription>External storage connections are scoped to your organization.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <FileStorageSettings
            role={role}
            organizationId={organizationId}
            awsConfigured={awsConfigured}
            integrations={(integrations as IntegrationRow[]) ?? []}
            storageSettings={(storageSettingsRes?.data as StorageSettingsRow) ?? null}
            recentRuns={(syncRunsRes?.data as SyncRunRow[]) ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}

