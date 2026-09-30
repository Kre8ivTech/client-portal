"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createStatusIncident, resolveStatusIncident } from "@/lib/actions/status-incidents";

export type StatusIncidentView = {
  id: string;
  title: string;
  body: string;
  severity: "maintenance" | "degraded" | "outage";
  status: "investigating" | "identified" | "monitoring" | "resolved";
  started_at: string;
};

export function StatusIncidentManager({ incidents }: { incidents: StatusIncidentView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<StatusIncidentView["severity"]>("maintenance");
  const [status, setStatus] = useState<StatusIncidentView["status"]>("investigating");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const chosenSeverity = severity;
    const chosenStatus = status;
    startTransition(async () => {
      const result = await createStatusIncident({
        title: String(form.get("title") || ""),
        body: String(form.get("body") || ""),
        severity: chosenSeverity,
        status: chosenStatus,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setError(null);
      formElement.reset();
      setSeverity("maintenance");
      setStatus("investigating");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={onSubmit} className="space-y-3 rounded-lg border p-4">
        <fieldset className="space-y-3">
          <legend className="text-base font-semibold">Post an incident</legend>
          <div className="space-y-1">
            <Label htmlFor="incident-title">Title</Label>
            <Input id="incident-title" name="title" required minLength={3} autoComplete="off" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="incident-body">What clients should know</Label>
            <Textarea id="incident-body" name="body" required minLength={8} rows={4} />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Severity</legend>
            {(["maintenance", "degraded", "outage"] as const).map((value) => (
              <label key={value} className="mr-4 inline-flex items-center gap-2 text-sm">
                <input type="radio" name="severity" value={value} checked={severity === value} onChange={() => setSeverity(value)} />
                {value}
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Status</legend>
            {(["investigating", "identified", "monitoring", "resolved"] as const).map((value) => (
              <label key={value} className="mr-4 inline-flex items-center gap-2 text-sm">
                <input type="radio" name="incidentStatus" value={value} checked={status === value} onChange={() => setStatus(value)} />
                {value}
              </label>
            ))}
          </fieldset>
        </fieldset>
        <div aria-live="polite">{error ? <p className="text-sm text-destructive">{error}</p> : null}</div>
        <Button type="submit" disabled={pending}>
          {pending ? "Posting..." : "Post incident"}
        </Button>
      </form>
      <ul className="space-y-3">
        {incidents.length === 0 ? <li className="text-sm text-muted-foreground">No incidents yet.</li> : null}
        {incidents.map((incident) => (
          <li key={incident.id} className="space-y-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{incident.title}</h3>
              <Badge variant="outline">{incident.status}</Badge>
            </div>
            <p className="text-sm">{incident.body}</p>
            <p className="text-xs capitalize text-muted-foreground">{incident.severity}</p>
            {incident.status !== "resolved" ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await resolveStatusIncident(incident.id);
                    if (!result.success) setError(result.error);
                    else router.refresh();
                  });
                }}
              >
                Mark resolved
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
