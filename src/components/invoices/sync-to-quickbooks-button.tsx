"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

interface SyncToQuickBooksButtonProps {
  invoiceId: string;
  quickbooksSyncStatus?: string | null;
  quickbooksInvoiceId?: string | null;
  isConnected: boolean;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}

export function SyncToQuickBooksButton({
  invoiceId,
  quickbooksSyncStatus,
  quickbooksInvoiceId,
  isConnected,
  size = "sm",
  variant = "outline",
}: SyncToQuickBooksButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(
        `/api/quickbooks/sync/invoice/${invoiceId}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync to QuickBooks");
      }

      setSuccess(true);
      router.refresh();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isConnected) {
    return null;
  }

  const isSynced = !!quickbooksInvoiceId;
  const hasError = quickbooksSyncStatus === "error";

  return (
    <div className="space-y-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              size={size}
              variant={variant}
              className="gap-2"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : isSynced ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Re-sync to QuickBooks
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sync to QuickBooks
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isSynced
                ? "Update this invoice in QuickBooks"
                : "Create this invoice in QuickBooks"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isSynced && !hasError && !success && (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200 w-full justify-center"
        >
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Synced to QuickBooks
        </Badge>
      )}

      {hasError && (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 border-red-200 w-full justify-center"
        >
          <AlertCircle className="mr-1 h-3 w-3" />
          Sync Failed
        </Badge>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Invoice synced to QuickBooks successfully!
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
