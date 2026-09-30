"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClientHandoff } from "@/lib/actions/handoffs";

const fieldClass = "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export type HandoffView = {
  id: string;
  title: string;
  summary: string;
  liveUrl: string | null;
  ownerName: string | null;
  updateNotes: string | null;
  organizationName: string;
};

export function HandoffManager({
  handoffs,
  canManage,
  organizations,
}: {
  handoffs: HandoffView[];
  canManage: boolean;
  organizations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    startTransition(async () => {
      const result = await createClientHandoff({
        organizationId: String(form.get("organizationId") || ""),
        title: String(form.get("title") || ""),
        summary: String(form.get("summary") || ""),
        liveUrl: String(form.get("liveUrl") || ""),
        ownerName: String(form.get("ownerName") || ""),
        updateNotes: String(form.get("updateNotes") || ""),
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

  return (
    <div className="space-y-4">
      {canManage ? (
        <form onSubmit={onSubmit} className="space-y-3 rounded-lg border p-4">
          <fieldset className="grid gap-3 md:grid-cols-2">
            <legend className="text-base font-semibold md:col-span-2">Record a handoff</legend>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="handoff-org">Organization</Label>
              <select id="handoff-org" name="organizationId" className={fieldClass} required defaultValue="">
                <option value="">Choose an organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="handoff-title">Title</Label>
              <Input id="handoff-title" name="title" required minLength={3} autoComplete="off" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="handoff-url">Live URL</Label>
              <Input id="handoff-url" name="liveUrl" type="url" placeholder="https://example.com" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="handoff-summary">What shipped</Label>
              <Textarea id="handoff-summary" name="summary" required minLength={8} rows={4} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="handoff-owner">Who owns updates</Label>
              <Input id="handoff-owner" name="ownerName" autoComplete="off" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="handoff-notes">Update notes</Label>
              <Textarea id="handoff-notes" name="updateNotes" rows={2} />
            </div>
          </fieldset>
          <div aria-live="polite">{error ? <p className="text-sm text-destructive">{error}</p> : null}</div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save handoff"}
          </Button>
        </form>
      ) : null}
      {handoffs.length === 0 ? <p className="text-sm text-muted-foreground">No handoffs yet.</p> : null}
      <ul className="space-y-3">
        {handoffs.map((handoff) => (
          <li key={handoff.id} className="space-y-2 rounded-lg border p-4">
            <h3 className="font-semibold">{handoff.title}</h3>
            {handoff.organizationName ? <p className="text-xs text-muted-foreground">{handoff.organizationName}</p> : null}
            <p className="whitespace-pre-wrap text-sm">{handoff.summary}</p>
            {handoff.liveUrl ? (
              <a href={handoff.liveUrl} className="text-sm underline" target="_blank" rel="noreferrer">
                {handoff.liveUrl}
              </a>
            ) : null}
            {handoff.ownerName ? <p className="text-sm">Owner: {handoff.ownerName}</p> : null}
            {handoff.updateNotes ? <p className="text-sm text-muted-foreground">{handoff.updateNotes}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
