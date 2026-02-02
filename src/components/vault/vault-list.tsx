"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDecryptedPassword, deleteVaultItem } from "@/lib/actions/vault";
import { checkEncryptionConfig } from "@/lib/actions/vault-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Trash2, ExternalLink, Copy, Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type VaultItemRow = {
  id: string;
  label: string;
  description: string | null;
  service_url: string | null;
  username: string | null;
  created_at: string;
};

export function VaultList({ items }: { items: VaultItemRow[] }) {
  const router = useRouter();
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    checkEncryptionConfig().then((status) => {
      if (!status.isConfigured) {
        setConfigError(true);
      }
    });
  }, []);

  async function handleReveal(id: string) {
    if (revealedId === id) {
      setRevealedId(null);
      setRevealedPassword(null);
      return;
    }
    setRevealedId(id);
    setRevealedPassword(null);
    try {
      const { password } = await getDecryptedPassword(id);
      setRevealedPassword(password);
    } catch {
      setRevealedPassword("[error]");
    }
  }

  async function handleCopy(password: string) {
    await navigator.clipboard.writeText(password);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteVaultItem(id);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        {configError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Configuration Error</AlertTitle>
            <AlertDescription>
              The <code>ENCRYPTION_SECRET</code> environment variable is missing or too short. Vault items cannot be encrypted/decrypted safely.
            </AlertDescription>
          </Alert>
        )}
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          No vault items yet. Add one with the form.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {configError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration Error</AlertTitle>
          <AlertDescription>
            The <code>ENCRYPTION_SECRET</code> environment variable is missing or too short. Vault items cannot be encrypted/decrypted safely.
          </AlertDescription>
        </Alert>
      )}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{item.label}</p>
                    {item.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
                    )}
                    {item.username && (
                      <p className="text-xs text-muted-foreground mt-1">User: {item.username}</p>
                    )}
                    {revealedId === item.id && revealedPassword !== null && (
                      <div className="mt-2 flex items-center gap-2">
                        <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                          {revealedPassword === "[error]" ? "Error loading" : revealedPassword}
                        </code>
                        {revealedPassword !== "[error]" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => handleCopy(revealedPassword)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {item.service_url && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a href={item.service_url} target="_blank" rel="noopener noreferrer" aria-label="Open URL">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleReveal(item.id)}
                      aria-label={revealedId === item.id ? "Hide password" : "Reveal password"}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      aria-label="Delete"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
