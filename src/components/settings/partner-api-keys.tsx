"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPartnerApiKey,
  revokePartnerApiKey,
  type PartnerApiKeySummary,
} from "@/lib/actions/partner-api-keys";

export function PartnerApiKeysCard({ keys }: { keys: PartnerApiKeySummary[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await createPartnerApiKey(name);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCreatedKey(result.apiKey);
    setName("");
    router.refresh();
  }

  async function onRevoke(id: string) {
    setPending(true);
    setError(null);
    const result = await revokePartnerApiKey(id);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onCreate} className="space-y-3" autoComplete="off">
        <div className="space-y-2">
          <Label htmlFor="partner-api-key-name">Key name</Label>
          <Input
            id="partner-api-key-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            required
            autoComplete="off"
            placeholder="WordPress monitor"
          />
        </div>
        <Button type="submit" disabled={pending}>
          Create API key
        </Button>
      </form>

      {createdKey && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="status">
          <p className="font-medium">Copy this key now. It will not be shown again.</p>
          <Input
            readOnly
            value={createdKey}
            className="mt-2 font-mono"
            aria-label="New partner API key"
            autoComplete="off"
          />
          <Button type="button" variant="outline" className="mt-3" onClick={() => setCreatedKey(null)}>
            Dismiss key
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <ul className="divide-y rounded-md border">
        {keys.length === 0 && <li className="p-4 text-sm text-muted-foreground">No API keys yet.</li>}
        {keys.map((key) => (
          <li key={key.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{key.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{key.key_prefix}…</p>
              <p className="text-xs text-muted-foreground">
                {key.is_active ? "Active" : "Revoked"}
                {key.last_used_at ? ` · Last used ${new Date(key.last_used_at).toLocaleString()}` : ""}
              </p>
            </div>
            {key.is_active && (
              <Button type="button" variant="outline" disabled={pending} onClick={() => onRevoke(key.id)}>
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>

      <p className="text-sm text-muted-foreground">
        Use the key as <span className="font-mono">Authorization: Bearer</span> against{" "}
        <span className="font-mono">/api/partner/v1/</span>. The stdio MCP server reads{" "}
        <span className="font-mono">KT_PORTAL_PARTNER_API_KEY</span> and{" "}
        <span className="font-mono">KT_PORTAL_BASE_URL</span>. Start it with{" "}
        <span className="font-mono">node mcp/kt-portal-partner/index.mjs</span>.
      </p>
    </div>
  );
}
