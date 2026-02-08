"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Search,
  RefreshCw,
  CloudIcon,
  Users,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FolderSync,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

type ClientIntegration = {
  id: string;
  provider: string;
  provider_email: string | null;
  status: string;
  last_sync_at: string | null;
  user_id: string;
};

type ClientOrg = {
  id: string;
  name: string;
  slug: string;
  type: string;
  userCount: number;
  integrations: ClientIntegration[];
  hasGoogleDrive: boolean;
  hasOneDrive: boolean;
  hasDropbox: boolean;
};

const providerLabels: Record<string, { label: string; color: string }> = {
  google_drive: {
    label: "Google Drive",
    color: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  },
  microsoft_onedrive: {
    label: "OneDrive",
    color: "bg-sky-500/10 text-sky-700 border-sky-500/30",
  },
  dropbox: {
    label: "Dropbox",
    color: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30",
  },
};

interface ClientCloudDrivesProps {
  awsConfigured: boolean;
}

export function ClientCloudDrives({ awsConfigured }: ClientCloudDrivesProps) {
  const [clients, setClients] = useState<ClientOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [syncingOrgId, setSyncingOrgId] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files/client-integrations");
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load client integrations");
      }

      setClients(json.data ?? []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load client data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleSyncClient = async (
    orgId: string,
    provider: string,
    userId: string
  ) => {
    setSyncingOrgId(`${orgId}:${provider}`);
    try {
      const res = await fetch("/api/file-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.details || json.error || "Sync failed");
      }

      toast.success("Files synced from client cloud drive");
      fetchClients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingOrgId(null);
    }
  };

  const filtered = clients.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase())
  );

  const totalConnected = clients.filter(
    (c) => c.hasGoogleDrive || c.hasOneDrive || c.hasDropbox
  ).length;

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Never";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4 bg-muted/20">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Total Client Orgs
          </div>
          <p className="text-2xl font-bold mt-1">{clients.length}</p>
        </div>
        <div className="rounded-lg border p-4 bg-muted/20">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CloudIcon className="h-4 w-4" />
            With Cloud Drives
          </div>
          <p className="text-2xl font-bold mt-1">{totalConnected}</p>
        </div>
        <div className="rounded-lg border p-4 bg-muted/20">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <XCircle className="h-4 w-4" />
            No Cloud Drive
          </div>
          <p className="text-2xl font-bold mt-1">
            {clients.length - totalConnected}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchClients}
          disabled={loading}
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {/* Client list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? "No clients match your search" : "No client organizations found"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((client) => {
            const hasAny =
              client.hasGoogleDrive ||
              client.hasOneDrive ||
              client.hasDropbox;

            return (
              <div
                key={client.id}
                className="rounded-lg border overflow-hidden"
              >
                {/* Client header */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {client.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {client.slug} -- {client.userCount} user
                        {client.userCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        hasAny
                          ? "bg-green-500/10 text-green-700 border-green-500/30"
                          : "text-muted-foreground"
                      }
                    >
                      {hasAny ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Connected
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1" />
                          No Drives
                        </>
                      )}
                    </Badge>
                  </div>
                </div>

                {/* Cloud drive integrations */}
                <div className="px-4 py-3 space-y-2">
                  {client.integrations.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No cloud drives connected for this client. The client
                      needs to connect their Google Drive, OneDrive, or Dropbox
                      from their File Storage settings.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {client.integrations.map((integration) => {
                        const providerInfo =
                          providerLabels[integration.provider] ?? {
                            label: integration.provider,
                            color: "",
                          };
                        const isSyncing =
                          syncingOrgId ===
                          `${client.id}:${integration.provider}`;

                        return (
                          <div
                            key={integration.id}
                            className="flex items-center justify-between py-2 px-3 rounded-md border bg-background"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Badge
                                variant="outline"
                                className={`text-xs ${providerInfo.color}`}
                              >
                                {providerInfo.label}
                              </Badge>
                              <div className="min-w-0">
                                <p className="text-xs truncate">
                                  {integration.provider_email || "Connected"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Last sync: {formatDate(integration.last_sync_at)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={
                                  integration.status === "active"
                                    ? "bg-green-500/10 text-green-700 border-green-500/30 text-xs"
                                    : "text-xs"
                                }
                              >
                                {integration.status}
                              </Badge>
                              {awsConfigured &&
                                integration.status === "active" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() =>
                                      handleSyncClient(
                                        client.id,
                                        integration.provider,
                                        integration.user_id
                                      )
                                    }
                                    disabled={isSyncing}
                                  >
                                    {isSyncing ? (
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    ) : (
                                      <FolderSync className="w-3 h-3 mr-1" />
                                    )}
                                    Pull Files
                                  </Button>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
