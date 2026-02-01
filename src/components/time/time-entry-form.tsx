"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTimeEntry } from "@/lib/actions/time-entries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TicketOption = { id: string; ticket_number: number; subject: string };
type PlanAssignmentOption = {
  id: string;
  plans: { name: string } | null;
  organizations: { name: string } | null;
};

interface TimeEntryFormProps {
  organizationId: string;
  tickets?: TicketOption[];
  planAssignments?: PlanAssignmentOption[];
  defaultPlanAssignmentId?: string;
  defaultWorkType?: "support" | "dev";
}

export function TimeEntryForm({
  organizationId,
  tickets = [],
  planAssignments = [],
  defaultPlanAssignmentId,
  defaultWorkType = "support",
}: TimeEntryFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [workType, setWorkType] = useState<"support" | "dev">(defaultWorkType);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await createTimeEntry(formData);
      form.reset();
      setWorkType("support");
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

      {planAssignments.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="plan_assignment_id">Plan Assignment (optional)</Label>
          <select
            id="plan_assignment_id"
            name="plan_assignment_id"
            defaultValue={defaultPlanAssignmentId || ""}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">None (unassigned time)</option>
            {planAssignments.map((pa) => (
              <option key={pa.id} value={pa.id}>
                {pa.organizations?.name ?? "Unknown Org"} - {pa.plans?.name ?? "Unknown Plan"}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Assign this time entry to a client&apos;s plan to track their hours.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="work_type">Work Type</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="work_type"
              value="support"
              checked={workType === "support"}
              onChange={() => setWorkType("support")}
              className="h-4 w-4 text-blue-600"
            />
            <span className="text-sm font-medium">Support</span>
            <span className="text-xs text-muted-foreground">(troubleshooting, updates, bugs)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="work_type"
              value="dev"
              checked={workType === "dev"}
              onChange={() => setWorkType("dev")}
              className="h-4 w-4 text-indigo-600"
            />
            <span className="text-sm font-medium">Development</span>
            <span className="text-xs text-muted-foreground">(new features, custom work)</span>
          </label>
        </div>
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
              #{t.ticket_number} {t.subject?.slice(0, 40) ?? ""}{t.subject && t.subject.length > 40 ? "..." : ""}
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
        {submitting ? "Logging..." : "Log Time"}
      </Button>
    </form>
  );
}
