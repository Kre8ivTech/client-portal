"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, XCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type PublicQuickBooksIntegration = {
  id: string;
  organization_id: string;
  realm_id: string;
  is_sandbox: boolean;
  auto_sync_enabled: boolean;
  last_sync_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
  company_name: string | null;
  connected_at: string;
};

type MappedCustomer = {
  qb_customer_id: string;
  display_name: string;
  email: string | null;
  portal_user_id: string | null;
};

interface QuickBooksIntegrationProps {
  integration: PublicQuickBooksIntegration | null;
  organizationId: string;
}

export function QuickBooksIntegration({
  integration,
}: QuickBooksIntegrationProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncingCustomers, setIsSyncingCustomers] = useState(false);
  const [isSavingAutoSync, setIsSavingAutoSync] = useState(false);
  const [customers, setCustomers] = useState<MappedCustomer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const autoSyncEnabled = Boolean(integration?.auto_sync_enabled);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch("/api/quickbooks/connect");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate connection");
      }

      // Redirect to QuickBooks authorization page
      window.location.href = data.authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setError(null);

    try {
      const response = await fetch("/api/quickbooks/disconnect", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to disconnect");
      }

      // Refresh the page to show updated state
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsDisconnecting(false);
    }
  };


  const loadCustomers = async () => {
    const response = await fetch("/api/quickbooks/customers");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to load QuickBooks customers");
    }
    setCustomers(data.data ?? []);
  };

  const handleSyncCustomers = async () => {
    setIsSyncingCustomers(true);
    setError(null);
    try {
      const response = await fetch("/api/quickbooks/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to sync customers");
      }
      await loadCustomers();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSyncingCustomers(false);
    }
  };

  const handleAutoSyncToggle = async (enabled: boolean) => {
    setIsSavingAutoSync(true);
    setError(null);
    try {
      const response = await fetch("/api/quickbooks/integration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_sync_enabled: enabled }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update auto-sync");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSavingAutoSync(false);
    }
  };


  useEffect(() => {
    if (!integration) {
      setCustomers([]);
      return;
    }
    loadCustomers().catch(() => {
      // listing is best-effort; connect/disconnect errors are shown separately
    });
    // loadCustomers is stable for this connected session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration?.id]);

  const isConnected = !!integration;
  const isSandbox = integration?.is_sandbox;
  const lastSyncAt = integration?.last_sync_at;
  const syncStatus = integration?.sync_status;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              QuickBooks Online
              {isConnected && (
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 border-green-200"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Connected
                </Badge>
              )}
              {isSandbox && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Sandbox
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Sync invoices and payments to QuickBooks Online for accounting
              and financial management.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isConnected ? (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <div className="flex items-center gap-2">
                  {syncStatus === "idle" && (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Ready</span>
                    </>
                  )}
                  {syncStatus === "syncing" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-sm text-blue-600">Syncing...</span>
                    </>
                  )}
                  {syncStatus === "error" && (
                    <>
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-600">Error</span>
                    </>
                  )}
                </div>
              </div>

              {lastSyncAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Last Sync</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(lastSyncAt).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Environment</span>
                <span className="text-sm text-muted-foreground">
                  {isSandbox ? "Sandbox" : "Production"}
                </span>
              </div>
              {integration?.company_name && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Company</span>
                  <span className="text-sm text-muted-foreground">
                    {integration.company_name}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Auto-sync new invoices</span>
                <Switch
                  checked={autoSyncEnabled}
                  disabled={isSavingAutoSync}
                  onCheckedChange={handleAutoSyncToggle}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium">QuickBooks customers</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSyncCustomers}
                  disabled={isSyncingCustomers}
                >
                  {isSyncingCustomers ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync customers
                </Button>
              </div>
              {customers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sync customers from QuickBooks to map them to portal clients. New invoices use this mapping when possible.
                </p>
              ) : (
                <ul className="space-y-1 text-sm text-muted-foreground max-h-40 overflow-y-auto">
                  {customers.slice(0, 12).map((customer) => (
                    <li key={customer.qb_customer_id} className="flex justify-between gap-2">
                      <span>{customer.display_name}</span>
                      <span>{customer.portal_user_id ? "Mapped" : "Unmapped"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Features</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Sync invoices to QuickBooks
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Sync payments (Stripe and manual)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Automatic customer matching
                </li>
              </ul>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={isDisconnecting}
                  className="w-full sm:w-auto"
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    "Disconnect QuickBooks"
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Disconnect QuickBooks?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the connection to QuickBooks. You will
                    need to reconnect to sync invoices and payments again.
                    <br />
                    <br />
                    <strong>Note:</strong> Previously synced data will remain
                    in QuickBooks.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDisconnect}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">What you get:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Automatic invoice syncing to QuickBooks
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Payment tracking for both Stripe and manual payments
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Seamless customer matching
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Real-time financial data
                </li>
              </ul>
            </div>

            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full sm:w-auto"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect QuickBooks"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
