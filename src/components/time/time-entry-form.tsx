"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTimeEntry } from "@/lib/actions/time-entries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TicketOption = { id: string; ticket_number: number; subject: string };

export function TimeEntryForm({ organizationId, tickets = [] }: { organizationId: string; tickets?: TicketOption[] }) {
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
      await createTimeEntry(formData);
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log time");
    } finally {
      setSubmitting(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="entry_date">Date</Label>
        <Input id="entry_date" name="entry_date" type="date" defaultValue={today} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" placeholder="What did you work on?" rows={3} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hours">Hours</Label>
        <Input
          id="hours"
          name="hours"
          type="number"
          step="0.25"
          min="0.25"
          max="24"
          placeholder="1.5"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket_id">Ticket (optional)</Label>
        <select
          id="ticket_id"
          name="ticket_id"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">None</option>
          {tickets.map((t) => (
            <option key={t.id} value={t.id}>
              #{t.ticket_number} {t.subject?.slice(0, 40) ?? ""}{t.subject && t.subject.length > 40 ? "…" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="billable" name="billable" value="true" defaultChecked className="rounded" />
        <Label htmlFor="billable" className="font-normal">Billable</Label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Logging…" : "Log Time"}
      </Button>
    </form>
  );
}
