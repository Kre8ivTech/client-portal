"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveMarketingCredentials } from "@/lib/actions/marketing-credentials";
import { MARKETING_PROVIDERS, type PublicProviderStatus } from "@/lib/marketing/providers";

export function MarketingCredentialsForm({ providers }: { providers: PublicProviderStatus[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>, providerId: PublicProviderStatus["id"]) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const provider = MARKETING_PROVIDERS.find((item) => item.id === providerId);
    if (!provider) return;
    const fields: Record<string, string> = {};
    for (const field of provider.fields) {
      fields[field.key] = String(form.get(field.key) ?? "");
    }
    setPendingId(providerId);
    setError(null);
    setMessage(null);
    const result = await saveMarketingCredentials({ provider: providerId, fields });
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    event.currentTarget.reset();
    setMessage(`${provider.label} saved.`);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {message && (
        <p className="text-sm text-green-700" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {providers.map((provider) => {
        const definition = MARKETING_PROVIDERS.find((item) => item.id === provider.id);
        if (!definition) return null;
        return (
          <form
            key={provider.id}
            className="space-y-4 rounded-md border p-4"
            autoComplete="off"
            onSubmit={(event) => onSubmit(event, provider.id)}
          >
            <fieldset className="space-y-4">
              <legend className="text-base font-semibold">{provider.label}</legend>
              <p className="text-sm text-muted-foreground">{provider.description}</p>
              {definition.fields.map((field) => {
                const status = provider.fields.find((item) => item.key === field.key);
                const describedBy = `${provider.id}-${field.key}-hint`;
                return (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={`${provider.id}-${field.key}`}>{field.label}</Label>
                    <Input
                      id={`${provider.id}-${field.key}`}
                      name={field.key}
                      type={field.secret ? "password" : field.inputMode === "url" ? "url" : "text"}
                      inputMode={field.inputMode === "url" ? "url" : "text"}
                      autoComplete={field.autoComplete}
                      defaultValue={field.secret ? "" : status?.value ?? ""}
                      aria-describedby={describedBy}
                      spellCheck={false}
                    />
                    <p id={describedBy} className="text-xs text-muted-foreground">
                      {field.secret
                        ? status?.configured
                          ? `${status.value}. Leave blank to keep the saved secret.`
                          : "Not saved yet."
                        : status?.configured
                          ? "Saved for this organization. Clear the field and save to remove it."
                          : "Not saved yet."}
                    </p>
                  </div>
                );
              })}
            </fieldset>
            <Button type="submit" disabled={pendingId === provider.id}>
              Save {provider.label}
            </Button>
          </form>
        );
      })}
    </div>
  );
}
