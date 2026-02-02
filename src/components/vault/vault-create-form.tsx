"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createVaultItem } from "@/lib/actions/vault";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export function VaultCreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await createVaultItem(formData);
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="label">Label</Label>
        <Input id="label" name="label" placeholder="e.g. AWS Console" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" placeholder="Notes" rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="service_url">URL (optional)</Label>
        <Input id="service_url" name="service_url" type="url" placeholder="https://..." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Username (optional)</Label>
        <Input id="username" name="username" placeholder="Login or email" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="password">Password</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger type="button">
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[250px]">
                <p>Credentials are encrypted with AES-256-GCM using a secure server-side key. Only authorized users in your organization can decrypt them.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input id="password" name="password" type="password" placeholder="••••••••" required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Adding…" : "Add to Vault"}
      </Button>
    </form>
  );
}
