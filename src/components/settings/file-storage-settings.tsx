"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, ExternalLink, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Integration = {
  id: string;
  provider: string;
  provider_email: string | null;
  status: string;
  last_sync_at: string | null;
};

type StorageSettings = {
  s3_prefix: string | null;
  enabled: boolean;
} | null;

type SyncRun = {
  id: string;
  provider: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  error: string | null;
  stats: unknown;
};

const providerUi = {
  google_drive: { label: "Google Drive", api: "google-drive" },
  microsoft_onedrive: { label: "Microsoft OneDrive", api: "microsoft-onedrive" },
  dropbox: { label: "Dropbox", api: "dropbox" },
} as const;

type ProviderKey = keyof typeof providerUi;

export function FileStorageSettings(props: {
  role: string;
  organizationId: string;
  awsConfigured: boolean;
  integrations: Integration[];
  storageSettings: StorageSettings;
  recentRuns: SyncRun[];
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdminOrStaff = props.role === "super_admin" || props.role === "staff";

  const [s3Prefix, setS3Prefix] = useState(props.storageSettings?.s3_prefix ?? "");
  const [s3Enabled, setS3Enabled] = useState(props.storageSettings?.enabled ?? true);

  const integrationsByProvider = useMemo(() => {
    const map: Record<string, Integration | undefined> = {};
    for (const i of props.integrations) {
      map[i.provider] = i;
    }
    return map;
  }, [props.integrations]);

  const connect = async (provider: ProviderKey) => {
    setLoading(`connect:${provider}`);
    setError(null);
    try {
      const res = await fetch(`/api/file-integrations/${providerUi[provider].api}`);
      const json = (await res.json()) as { authUrl?: string; error?: string };
      if (!res.ok || json.error) {
        setError(json.error || "Failed to initiate connection");
        return;
      }
      if (json.authUrl) window.location.href = json.authUrl;
    } catch {
      setError("Failed to initiate connection");
    } finally {
      setLoading(null);
    }
  };

  const disconnect = async (provider: ProviderKey) => {
    setLoading(`disconnect:${provider}`);
    setError(null);
    try {
      const res = await fetch(`/api/file-integrations/${providerUi[provider].api}`, { method: "DELETE" });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || json.error) {
        setError(json.error || "Failed to disconnect");
        return;
      }
      toast({ title: "Disconnected", description: `${providerUi[provider].label} disconnected.` });
      window.location.reload();
    } catch {
      setError("Failed to disconnect");
    } finally {
      setLoading(null);
    }
  };

  const syncNow = async (provider: ProviderKey) => {
    setLoading(`sync:${provider}`);
    setError(null);
    try {
      const res = await fetch("/api/file-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; details?: string; data?: any };
      if (!res.ok || json.error) {
        setError(json.details || json.error || "Sync failed");
        return;
      }
      toast({ title: "Sync complete", description: "Files were synced into secure storage." });
      window.location.reload();
    } catch {
      setError("Sync failed");
    } finally {
      setLoading(null);
    }
  };

  const saveS3Settings = async () => {
    setLoading("save:s3");
    setError(null);
    try {
      const res = await fetch("/api/file-storage/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3_prefix: s3Prefix.trim() ? s3Prefix.trim() : null,
          enabled: s3Enabled,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || json.error) {
        setError(json.error || "Failed to save settings");
        return;
      }
      toast({ title: "Saved", description: "S3 destination settings updated." });
      window.location.reload();
    } catch {
      setError("Failed to save settings");
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Never";
    return d.toLocaleString();
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Destination (S3) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Secure destination (AWS S3)</p>
            <p className="text-xs text-muted-foreground">
              Files are stored under an organization-scoped prefix to keep tenants separated.
            </p>
          </div>
          <Badge
            variant="outline"
            className={props.awsConfigured ? "bg-green-500/10 text-green-600 border-green-500/30" : "bg-muted text-muted-foreground"}
          >
            {props.awsConfigured ? (
              <>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Configured
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3 mr-1" />
                Not Configured
              </>
            )}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="s3-prefix">S3 key prefix (optional)</Label>
            <Input
              id="s3-prefix"
              placeholder={`org/${props.organizationId}/external/...`}
              value={s3Prefix}
              onChange={(e) => setS3Prefix(e.target.value)}
              disabled={!isAdminOrStaff || loading === "save:s3"}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the default `org/&lt;org_id&gt;` prefix.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="block">Enable file storage</Label>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Organization file storage</p>
                <p className="text-xs text-muted-foreground">Disable to block sync into S3 for this organization.</p>
              </div>
              <Switch checked={s3Enabled} onCheckedChange={setS3Enabled} disabled={!isAdminOrStaff || loading === "save:s3"} />
            </div>
          </div>
        </div>

        {isAdminOrStaff && (
          <div className="flex justify-end">
            <Button onClick={saveS3Settings} disabled={loading === "save:s3"}>
              {loading === "save:s3" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save S3 Settings
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Provider connections */}
      <div className="space-y-4">
        <div>
          <p className="font-semibold">Source connections</p>
          <p className="text-xs text-muted-foreground">Connect a provider, then run sync to copy files into secure storage.</p>
        </div>

        {(Object.keys(providerUi) as ProviderKey[]).map((provider) => {
          const integration = integrationsByProvider[provider];
          const connected = !!integration;
          return (
            <div key={provider} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="min-w-0">
                <p className="font-medium">{providerUi[provider].label}</p>
                <p className="text-xs text-muted-foreground">
                  {connected ? (
                    <>
                      {integration?.provider_email || "Connected"} • Last sync: {formatDate(integration?.last_sync_at ?? null)}
                    </>
                  ) : (
                    "Not connected"
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {connected ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncNow(provider)}
                      disabled={!props.awsConfigured || loading === `sync:${provider}`}
                    >
                      {loading === `sync:${provider}` ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3 mr-1" />
                      )}
                      Sync now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnect(provider)}
                      disabled={loading === `disconnect:${provider}`}
                    >
                      {loading === `disconnect:${provider}` && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => connect(provider)}
                    disabled={loading === `connect:${provider}`}
                  >
                    {loading === `connect:${provider}` && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    Connect
                  </Button>
                )}
                <a
                  href="/dashboard/vault"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  title="Store related credentials securely"
                >
                  Vault <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Recent runs */}
      <div className="space-y-3">
        <div>
          <p className="font-semibold">Recent sync runs</p>
          <p className="text-xs text-muted-foreground">
            A short history of your recent sync attempts (scoped to your organization).
          </p>
        </div>

        {props.recentRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sync runs yet.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/30 text-xs font-semibold">
              <div className="col-span-3">Provider</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-4">Started</div>
              <div className="col-span-3">Result</div>
            </div>
            {props.recentRuns.map((r) => (
              <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-t">
                <div className="col-span-3">{providerUi[r.provider as ProviderKey]?.label ?? r.provider}</div>
                <div className="col-span-2">
                  <Badge variant="outline">{r.status}</Badge>
                </div>
                <div className="col-span-4 text-muted-foreground">{formatDate(r.created_at)}</div>
                <div className="col-span-3 text-muted-foreground truncate">
                  {r.status === "error" ? r.error || "Error" : "OK"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

