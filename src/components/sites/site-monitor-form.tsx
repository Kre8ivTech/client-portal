"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addSiteMonitor } from "@/lib/actions/site-monitors";

const fieldClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm";

export function SiteMonitorForm({ organizations }: { organizations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    startTransition(async () => {
      const result = await addSiteMonitor({
        organizationId: String(form.get("organizationId") || ""),
        name: String(form.get("name") || ""),
        url: String(form.get("url") || ""),
        platform: String(form.get("platform") || ""),
        maintenanceWindow: String(form.get("maintenanceWindow") || ""),
        careNotes: String(form.get("careNotes") || ""),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setError(null);
      formElement.reset();
      router.refresh();
    });
  }

  if (organizations.length === 0) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        No organizations are available to attach a site to.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border p-4">
      <fieldset className="grid gap-3 md:grid-cols-2">
        <legend className="text-base font-semibold md:col-span-2">Add a site</legend>
        <p id="site-monitor-help" className="text-sm text-muted-foreground md:col-span-2">
          The site is saved for the selected organization. Status stays unknown until a check is recorded.
        </p>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="site-org">Organization</Label>
          <select
            id="site-org"
            name="organizationId"
            className={fieldClass}
            required
            defaultValue=""
            aria-describedby="site-monitor-help"
          >
            <option value="">Choose an organization</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="site-name">Name</Label>
          <Input id="site-name" name="name" required minLength={2} autoComplete="off" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="site-url">URL</Label>
          <Input id="site-url" name="url" type="url" required autoComplete="url" placeholder="https://example.com" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="site-platform">Platform</Label>
          <Input id="site-platform" name="platform" placeholder="WordPress, custom app, mobile" autoComplete="off" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="site-window">Maintenance window</Label>
          <Input id="site-window" name="maintenanceWindow" placeholder="Tuesdays 02:00 CT" autoComplete="off" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="site-notes">Care notes</Label>
          <Textarea id="site-notes" name="careNotes" rows={2} />
        </div>
      </fieldset>
      <div aria-live="polite">
        {error ? (
          <p id="site-monitor-error" className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Add site"}
      </Button>
    </form>
  );
}
