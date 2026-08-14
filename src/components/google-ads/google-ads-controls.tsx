"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { GoogleAdsAccount } from "@/lib/google-ads/types";

type GoogleAdsControlsProps = {
  connected: boolean;
  configured: boolean;
  selectedCustomerId: string | null;
  accounts: GoogleAdsAccount[];
  canManageConnection: boolean;
};

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: unknown };
    return typeof payload.error === "string" ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

export function GoogleAdsControls({
  connected,
  configured,
  selectedCustomerId,
  accounts,
  canManageConnection,
}: GoogleAdsControlsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"connect" | "select" | "sync" | "disconnect" | null>(null);
  const [customerId, setCustomerId] = useState(selectedCustomerId ?? accounts[0]?.customerId ?? "");

  async function connect() {
    setPendingAction("connect");
    try {
      const response = await fetch("/api/integrations/google-ads");
      if (!response.ok) throw new Error(await errorMessage(response, "Could not start Google connection"));
      const payload = await response.json() as { authUrl?: unknown };
      if (typeof payload.authUrl !== "string") throw new Error("Google connection URL was missing");
      window.location.assign(payload.authUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect Google Ads");
      setPendingAction(null);
    }
  }

  async function selectAccount() {
    if (!customerId) return;
    setPendingAction("select");
    try {
      const response = await fetch("/api/integrations/google-ads/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Could not select account"));
      toast.success("Google Ads account selected and synced");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not select account");
    } finally {
      setPendingAction(null);
    }
  }

  async function sync() {
    setPendingAction("sync");
    try {
      const response = await fetch("/api/integrations/google-ads/sync", { method: "POST" });
      if (!response.ok) throw new Error(await errorMessage(response, "Google Ads sync failed"));
      toast.success("Google Ads reporting is up to date");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google Ads sync failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Google Ads and remove its reporting history from this portal?")) return;
    setPendingAction("disconnect");
    try {
      const response = await fetch("/api/integrations/google-ads", { method: "DELETE" });
      if (!response.ok) throw new Error(await errorMessage(response, "Could not disconnect Google Ads"));
      toast.success("Google Ads disconnected");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect Google Ads");
    } finally {
      setPendingAction(null);
    }
  }

  if (!connected) {
    if (!canManageConnection) {
      return <p className="text-sm text-muted-foreground">A partner administrator can connect Google Ads.</p>;
    }
    return (
      <Button onClick={connect} disabled={!configured || pendingAction !== null}>
        {pendingAction === "connect" ? "Opening Google..." : "Connect Google Ads"}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {canManageConnection && accounts.length > 0 && (
        <div className="min-w-0 flex-1 space-y-1 sm:min-w-72">
          <label htmlFor="google-ads-account" className="text-xs font-medium text-muted-foreground">
            Advertising account
          </label>
          <select
            id="google-ads-account"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>Select an account</option>
            {accounts.map((account) => (
              <option key={account.customerId} value={account.customerId}>
                {account.name} ({account.customerId})
              </option>
            ))}
          </select>
        </div>
      )}
      {canManageConnection && customerId && customerId !== selectedCustomerId && (
        <Button onClick={selectAccount} disabled={pendingAction !== null}>
          {pendingAction === "select" ? "Selecting..." : "Use this account"}
        </Button>
      )}
      {selectedCustomerId && (
        <Button variant="outline" onClick={sync} disabled={pendingAction !== null}>
          <RefreshCw className={pendingAction === "sync" ? "animate-spin" : ""} />
          {pendingAction === "sync" ? "Syncing..." : "Sync now"}
        </Button>
      )}
      {canManageConnection && (
        <Button variant="ghost" onClick={disconnect} disabled={pendingAction !== null}>
          <Unplug />
          {pendingAction === "disconnect" ? "Disconnecting..." : "Disconnect"}
        </Button>
      )}
    </div>
  );
}
