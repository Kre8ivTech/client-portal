"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  assignAgentTask,
  deleteAgentWorkflow,
  runAgentScheduleNow,
  saveAgentSchedule,
  saveAgentWorkflow,
  setAgentScheduleActive,
  updateAgentTaskStatus,
} from "@/lib/actions/agent-workflows";
import { SCHEDULE_TIME_ZONES, WEEKDAY_LABELS } from "@/lib/ai/workflow-schedule";

export type AgentOption = { id: string; name: string };
export type PersonOption = { id: string; label: string };
export type WorkflowStepView = { id: string; agentId: string; agentName: string; instruction: string };
export type WorkflowView = {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "paused";
  steps: WorkflowStepView[];
};
export type AssignmentView = {
  id: string;
  title: string;
  details: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  dueAt: string | null;
  workflowName: string;
  assigneeLabel: string;
};
export type ScheduleView = {
  id: string;
  workflowName: string;
  assigneeLabel: string;
  frequency: "daily" | "weekdays" | "weekly";
  weekday: number | null;
  timeOfDay: string;
  timeZone: string;
  isActive: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
};

type DraftStep = { key: string; agentId: string; instruction: string };

const fieldClass = "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function formatWhen(value: string | null) {
  if (!value) return "Not run yet";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function scheduleLabel(schedule: ScheduleView) {
  const day = schedule.frequency === "weekly" && schedule.weekday != null ? `${WEEKDAY_LABELS[schedule.weekday]}s` : schedule.frequency;
  return `${day} at ${schedule.timeOfDay.slice(0, 5)} ${schedule.timeZone}`;
}

export function AgentWorkflowManager({
  agents,
  people,
  workflows,
  assignments,
  schedules,
}: {
  agents: AgentOption[];
  people: PersonOption[];
  workflows: WorkflowView[];
  assignments: AssignmentView[];
  schedules: ScheduleView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | "new">("new");
  const selected = workflows.find((workflow) => workflow.id === selectedId) ?? null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<WorkflowView["status"]>("draft");
  const [steps, setSteps] = useState<DraftStep[]>([{ key: "new-1", agentId: agents[0]?.id ?? "", instruction: "" }]);
  const [assignmentWorkflowId, setAssignmentWorkflowId] = useState(workflows[0]?.id ?? "");
  const [scheduleWorkflowId, setScheduleWorkflowId] = useState(workflows[0]?.id ?? "");
  const [frequency, setFrequency] = useState<"daily" | "weekdays" | "weekly">("weekdays");

  const assignmentSteps = useMemo(
    () => workflows.find((workflow) => workflow.id === assignmentWorkflowId)?.steps ?? [],
    [assignmentWorkflowId, workflows],
  );

  function notice(result: { success: boolean; error?: string }, successText: string) {
    if (!result.success) {
      setError(result.error || "Something went wrong");
      setMessage(null);
      return false;
    }
    setError(null);
    setMessage(successText);
    router.refresh();
    return true;
  }

  function loadWorkflow(workflow: WorkflowView | null) {
    setSelectedId(workflow?.id ?? "new");
    setName(workflow?.name ?? "");
    setDescription(workflow?.description ?? "");
    setStatus(workflow?.status ?? "draft");
    setSteps(
      workflow?.steps.length
        ? workflow.steps.map((step) => ({ key: step.id, agentId: step.agentId, instruction: step.instruction }))
        : [{ key: crypto.randomUUID(), agentId: agents[0]?.id ?? "", instruction: "" }],
    );
    setError(null);
  }

  function onSaveWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveAgentWorkflow({
        id: selected?.id,
        name,
        description,
        status,
        steps: steps.map((step) => ({ agentId: step.agentId, instruction: step.instruction })),
      });
      if (notice(result, "Workflow saved")) {
        if (result.success) setSelectedId(result.id);
      }
    });
  }

  function onAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const dueValue = String(form.get("dueAt") || "");
    startTransition(async () => {
      const result = await assignAgentTask({
        title: String(form.get("title") || ""),
        workflowId: String(form.get("workflowId") || ""),
        stepId: String(form.get("stepId") || "") || null,
        assigneeId: String(form.get("assigneeId") || ""),
        details: String(form.get("details") || ""),
        dueAt: dueValue ? new Date(dueValue).toISOString() : null,
      });
      if (notice(result, "Task assigned")) formElement.reset();
    });
  }

  function onSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const weekdayValue = String(form.get("weekday") || "");
    startTransition(async () => {
      const result = await saveAgentSchedule({
        workflowId: String(form.get("workflowId") || ""),
        assigneeId: String(form.get("assigneeId") || ""),
        frequency,
        weekday: frequency === "weekly" && weekdayValue !== "" ? Number(weekdayValue) : null,
        timeOfDay: String(form.get("timeOfDay") || ""),
        timeZone: String(form.get("timeZone") || "UTC") as (typeof SCHEDULE_TIME_ZONES)[number],
        isActive: form.get("isActive") === "on",
      });
      if (notice(result, "Schedule saved")) formElement.reset();
    });
  }

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="min-h-6 text-sm">
        {error ? <p className="text-destructive">{error}</p> : null}
        {message ? <p>{message}</p> : null}
      </div>
      <Tabs defaultValue="workflows" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            <Button type="button" variant="outline" className="w-full" onClick={() => loadWorkflow(null)}>
              New workflow
            </Button>
            {workflows.length === 0 ? <p className="text-sm text-muted-foreground">No workflows yet.</p> : null}
            <ul className="space-y-2">
              {workflows.map((workflow) => (
                <li key={workflow.id}>
                  <button
                    type="button"
                    onClick={() => loadWorkflow(workflow)}
                    className="w-full rounded-md border px-3 py-2 text-left hover:bg-muted"
                  >
                    <span className="block font-medium">{workflow.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {workflow.steps.length} steps · {workflow.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={onSaveWorkflow} className="space-y-4 rounded-lg border p-4">
            <fieldset className="space-y-3">
              <legend className="text-base font-semibold">{selected ? "Edit workflow" : "Build a workflow"}</legend>
              <div className="space-y-1">
                <Label htmlFor="workflow-name">Name</Label>
                <Input id="workflow-name" name="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="workflow-description">Description</Label>
                <Textarea id="workflow-description" name="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Status</legend>
                {(["draft", "active", "paused"] as const).map((value) => (
                  <label key={value} className="mr-4 inline-flex items-center gap-2 text-sm">
                    <input type="radio" name="status" value={value} checked={status === value} onChange={() => setStatus(value)} />
                    {value}
                  </label>
                ))}
              </fieldset>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Steps</legend>
              {steps.map((step, index) => (
                <div key={step.key} className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">Step {index + 1}</p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => setSteps((current) => {
                        const next = [...current];
                        const [item] = next.splice(index, 1);
                        next.splice(index - 1, 0, item);
                        return next;
                      })}>
                        Move up
                      </Button>
                      <Button type="button" variant="outline" size="sm" disabled={index === steps.length - 1} onClick={() => setSteps((current) => {
                        const next = [...current];
                        const [item] = next.splice(index, 1);
                        next.splice(index + 1, 0, item);
                        return next;
                      })}>
                        Move down
                      </Button>
                      <Button type="button" variant="outline" size="sm" disabled={steps.length === 1} onClick={() => setSteps((current) => current.filter((item) => item.key !== step.key))}>
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`step-agent-${step.key}`}>Agent</Label>
                    <select id={`step-agent-${step.key}`} className={fieldClass} value={step.agentId} onChange={(event) => setSteps((current) => current.map((item) => item.key === step.key ? { ...item, agentId: event.target.value } : item))} required>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`step-instruction-${step.key}`}>Instruction</Label>
                    <Textarea id={`step-instruction-${step.key}`} value={step.instruction} onChange={(event) => setSteps((current) => current.map((item) => item.key === step.key ? { ...item, instruction: event.target.value } : item))} required minLength={3} rows={2} />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => setSteps((current) => [...current, { key: crypto.randomUUID(), agentId: agents[0]?.id ?? "", instruction: "" }])}>
                Add step
              </Button>
            </fieldset>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save workflow"}</Button>
              {selected ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await deleteAgentWorkflow(selected.id);
                      if (notice(result, "Workflow deleted")) loadWorkflow(null);
                    });
                  }}
                >
                  Delete workflow
                </Button>
              ) : null}
            </div>
          </form>
        </TabsContent>

        <TabsContent value="assignments" className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={onAssign} className="space-y-3 rounded-lg border p-4">
            <fieldset className="space-y-3">
              <legend className="text-base font-semibold">Assign a task</legend>
              <div className="space-y-1">
                <Label htmlFor="assignment-title">Title</Label>
                <Input id="assignment-title" name="title" required minLength={2} autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="assignment-workflow">Workflow</Label>
                <select id="assignment-workflow" name="workflowId" className={fieldClass} required value={assignmentWorkflowId} onChange={(event) => setAssignmentWorkflowId(event.target.value)}>
                  <option value="">Choose a workflow</option>
                  {workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="assignment-step">Step</Label>
                <select id="assignment-step" name="stepId" className={fieldClass} defaultValue="">
                  <option value="">Whole workflow</option>
                  {assignmentSteps.map((step, index) => (
                    <option key={step.id} value={step.id}>Step {index + 1}: {step.agentName}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="assignment-assignee">Assignee</Label>
                <select id="assignment-assignee" name="assigneeId" className={fieldClass} required defaultValue="">
                  <option value="">Choose a person</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>{person.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="assignment-due">Due</Label>
                <Input id="assignment-due" name="dueAt" type="datetime-local" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="assignment-details">Details</Label>
                <Textarea id="assignment-details" name="details" rows={3} />
              </div>
            </fieldset>
            <Button type="submit" disabled={pending}>{pending ? "Assigning..." : "Assign task"}</Button>
          </form>

          <div className="space-y-3">
            <h3 className="font-semibold">Assigned tasks</h3>
            {assignments.length === 0 ? <p className="text-sm text-muted-foreground">No tasks assigned yet.</p> : null}
            <ul className="space-y-3">
              {assignments.map((assignment) => (
                <li key={assignment.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">{assignment.workflowName} · {assignment.assigneeLabel}</p>
                    </div>
                    <Badge variant="outline">{assignment.status.replace("_", " ")}</Badge>
                  </div>
                  {assignment.details ? <p className="text-sm">{assignment.details}</p> : null}
                  <p className="text-xs text-muted-foreground">Due {formatWhen(assignment.dueAt)}</p>
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const statusValue = String(new FormData(event.currentTarget).get("status"));
                      startTransition(async () => {
                        const result = await updateAgentTaskStatus({
                          id: assignment.id,
                          status: statusValue as AssignmentView["status"],
                        });
                        notice(result, "Assignment updated");
                      });
                    }}
                  >
                    <div className="space-y-1">
                      <Label htmlFor={`status-${assignment.id}`}>Status</Label>
                      <select id={`status-${assignment.id}`} name="status" className={fieldClass} defaultValue={assignment.status}>
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <Button type="submit" variant="outline" disabled={pending}>Save status</Button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={onSchedule} className="space-y-3 rounded-lg border p-4">
            <fieldset className="space-y-3">
              <legend className="text-base font-semibold">Schedule a workflow</legend>
              <p className="text-sm text-muted-foreground">An active workflow creates one assigned task per step when the schedule runs.</p>
              <div className="space-y-1">
                <Label htmlFor="schedule-workflow">Workflow</Label>
                <select id="schedule-workflow" name="workflowId" className={fieldClass} required value={scheduleWorkflowId} onChange={(event) => setScheduleWorkflowId(event.target.value)}>
                  <option value="">Choose a workflow</option>
                  {workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>{workflow.name} ({workflow.status})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="schedule-assignee">Assignee</Label>
                <select id="schedule-assignee" name="assigneeId" className={fieldClass} required defaultValue="">
                  <option value="">Choose a person</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>{person.label}</option>
                  ))}
                </select>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Frequency</legend>
                {(["daily", "weekdays", "weekly"] as const).map((value) => (
                  <label key={value} className="mr-4 inline-flex items-center gap-2 text-sm">
                    <input type="radio" name="frequency" value={value} checked={frequency === value} onChange={() => setFrequency(value)} />
                    {value}
                  </label>
                ))}
              </fieldset>
              {frequency === "weekly" ? (
                <div className="space-y-1">
                  <Label htmlFor="schedule-weekday">Weekday</Label>
                  <select id="schedule-weekday" name="weekday" className={fieldClass} required defaultValue="1">
                    {WEEKDAY_LABELS.map((label, index) => (
                      <option key={label} value={index}>{label}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="space-y-1">
                <Label htmlFor="schedule-time">Time</Label>
                <Input id="schedule-time" name="timeOfDay" type="time" required defaultValue="09:00" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="schedule-timezone">Timezone</Label>
                <select id="schedule-timezone" name="timeZone" className={fieldClass} defaultValue="UTC">
                  {SCHEDULE_TIME_ZONES.map((zone) => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>
              <label className="inline-flex items-center gap-2 text-sm" htmlFor="schedule-active">
                <input id="schedule-active" name="isActive" type="checkbox" defaultChecked />
                Active
              </label>
            </fieldset>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save schedule"}</Button>
          </form>

          <div className="space-y-3">
            <h3 className="font-semibold">Upcoming runs</h3>
            {schedules.length === 0 ? <p className="text-sm text-muted-foreground">No schedules yet.</p> : null}
            <ul className="space-y-3">
              {schedules.map((schedule) => (
                <li key={schedule.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{schedule.workflowName}</p>
                      <p className="text-sm text-muted-foreground">{scheduleLabel(schedule)}</p>
                      <p className="text-xs text-muted-foreground">Assigned to {schedule.assigneeLabel}</p>
                    </div>
                    <Badge variant={schedule.isActive ? "default" : "secondary"}>{schedule.isActive ? "Active" : "Paused"}</Badge>
                  </div>
                  <p className="text-sm">Next run {formatWhen(schedule.nextRunAt)}</p>
                  <p className="text-xs text-muted-foreground">Last run {formatWhen(schedule.lastRunAt)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending || !schedule.isActive}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await runAgentScheduleNow(schedule.id);
                          notice(result, result.success ? `Created ${result.created} task${result.created === 1 ? "" : "s"}` : "");
                        });
                      }}
                    >
                      Run now
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await setAgentScheduleActive(schedule.id, !schedule.isActive);
                          notice(result, schedule.isActive ? "Schedule paused" : "Schedule resumed");
                        });
                      }}
                    >
                      {schedule.isActive ? "Pause" : "Resume"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
