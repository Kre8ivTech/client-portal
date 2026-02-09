"use client";

import { useState } from "react";
import { Play, Square, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { createTimeEntry } from "@/lib/actions/time-entries";
import { useRouter } from "next/navigation";
import { cn, calculateBillableHours } from "@/lib/utils";
import { useWorkTimer } from "@/hooks/use-work-timer";
import { InactivityDialog } from "./inactivity-dialog";

interface WorkTimerButtonProps {
  organizationId: string;
  tickets?: Array<{ id: string; ticket_number: number; subject: string }>;
  planAssignments?: Array<{
    id: string;
    plans: { name: string } | null;
    organizations: { name: string } | null;
  }>;
}

export function WorkTimerButton({
  organizationId,
  tickets = [],
  planAssignments = [],
}: WorkTimerButtonProps) {
  const router = useRouter();
  const {
    isRunning,
    elapsedSeconds,
    showInactivityDialog,
    startTimer,
    stopTimer,
    resetTimer,
    handleInactivityContinue,
    handleInactivityStop,
  } = useWorkTimer();

  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workType, setWorkType] = useState<"support" | "dev">("support");

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStart = () => {
    startTimer();
    setError(null);
  };

  const handleStop = () => {
    stopTimer();
    setShowDialog(true);
  };

  const handleCancel = () => {
    setShowDialog(false);
    resetTimer();
    setError(null);
    setWorkType("support");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Convert elapsed seconds to hours and minutes
    const totalMinutes = Math.floor(elapsedSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    formData.set("hours", hours.toString());
    formData.set("minutes", minutes.toString());

    try {
      const result = await createTimeEntry(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setShowDialog(false);
      resetTimer();
      setWorkType("support");
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log time");
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="flex items-center gap-2">
        {isRunning && (
          <div className="hidden sm:flex items-center gap-1.5 text-sm font-mono text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatTime(elapsedSeconds)}
          </div>
        )}
        <Button
          variant={isRunning ? "destructive" : "default"}
          size="sm"
          onClick={isRunning ? handleStop : handleStart}
          className={cn(
            "flex items-center gap-2 transition-all",
            isRunning && "animate-pulse"
          )}
        >
          {isRunning ? (
            <>
              <Square className="h-4 w-4" />
              <span className="hidden sm:inline">Stop Timer</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Start Timer</span>
            </>
          )}
        </Button>
      </div>

      <InactivityDialog
        open={showInactivityDialog}
        onContinue={handleInactivityContinue}
        onStop={handleInactivityStop}
      />

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Log Time Entry</DialogTitle>
              <DialogDescription>
                You worked for {formatTime(elapsedSeconds)}.
                {" "}Billable: {calculateBillableHours(elapsedSeconds / 3600)} hour{calculateBillableHours(elapsedSeconds / 3600) !== 1 ? "s" : ""}.
                {" "}Enter the details below.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="entry_date">Date</Label>
                <Input
                  id="entry_date"
                  name="entry_date"
                  type="date"
                  defaultValue={today}
                  required
                />
              </div>

              {planAssignments.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="plan_assignment_id">Plan Assignment (optional)</Label>
                  <select
                    id="plan_assignment_id"
                    name="plan_assignment_id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">None (unassigned time)</option>
                    {planAssignments.map((pa) => (
                      <option key={pa.id} value={pa.id}>
                        {pa.organizations?.name ?? "Unknown Org"} -{" "}
                        {pa.plans?.name ?? "Unknown Plan"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="work_type">Work Type</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="work_type"
                      value="support"
                      checked={workType === "support"}
                      onChange={() => setWorkType("support")}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium">Support</span>
                    <span className="text-xs text-muted-foreground">
                      (troubleshooting, updates, bugs)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="work_type"
                      value="dev"
                      checked={workType === "dev"}
                      onChange={() => setWorkType("dev")}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium">Development</span>
                    <span className="text-xs text-muted-foreground">
                      (new features, custom work)
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">What did you work on?</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Describe the work you completed..."
                  rows={4}
                  required
                />
              </div>

              {tickets.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="ticket_id">Related Ticket (optional)</Label>
                  <select
                    id="ticket_id"
                    name="ticket_id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">None</option>
                    {tickets.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.ticket_number} {t.subject?.slice(0, 40) ?? ""}
                        {t.subject && t.subject.length > 40 ? "..." : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="billable"
                  name="billable"
                  value="true"
                  defaultChecked
                  className="rounded"
                />
                <Label htmlFor="billable" className="font-normal">
                  Billable
                </Label>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save Time Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
