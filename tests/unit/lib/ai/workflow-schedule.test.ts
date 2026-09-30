import { describe, expect, it } from "vitest";
import { buildAssignmentDrafts, nextRunAt } from "@/lib/ai/workflow-schedule";

describe("workflow schedule", () => {
  it("uses the same day when the time is still ahead", () => {
    const next = nextRunAt({
      frequency: "daily",
      timeOfDay: "09:00",
      timeZone: "UTC",
      from: new Date("2026-09-30T08:00:00.000Z"),
    });
    expect(next.toISOString()).toBe("2026-09-30T09:00:00.000Z");
  });

  it("moves a daily run to the next day after the time has passed", () => {
    const next = nextRunAt({
      frequency: "daily",
      timeOfDay: "09:00",
      timeZone: "UTC",
      from: new Date("2026-09-30T10:00:00.000Z"),
    });
    expect(next.toISOString()).toBe("2026-10-01T09:00:00.000Z");
  });

  it("skips the weekend for weekday schedules", () => {
    const next = nextRunAt({
      frequency: "weekdays",
      timeOfDay: "18:00",
      timeZone: "UTC",
      from: new Date("2026-10-02T19:00:00.000Z"),
    });
    expect(next.toISOString()).toBe("2026-10-05T18:00:00.000Z");
  });

  it("keeps a weekly run in the requested timezone", () => {
    const next = nextRunAt({
      frequency: "weekly",
      weekday: 3,
      timeOfDay: "15:00",
      timeZone: "America/Chicago",
      from: new Date("2026-09-30T21:00:00.000Z"),
    });
    expect(next.toISOString()).toBe("2026-10-07T20:00:00.000Z");
  });

  it("creates one assignment per workflow step", () => {
    const drafts = buildAssignmentDrafts({
      workflowId: "wf",
      workflowName: "Morning check",
      assigneeId: "user",
      dueAt: new Date("2026-10-01T09:00:00.000Z"),
      steps: [
        { id: "step-1", agentName: "Tickets", instruction: "Review open tickets" },
        { id: "step-2", agentName: "Invoices", instruction: "Check unpaid invoices" },
      ],
    });
    expect(drafts).toEqual([
      {
        workflowId: "wf",
        stepId: "step-1",
        title: "Morning check: Tickets",
        details: "Review open tickets",
        assigneeId: "user",
        dueAt: "2026-10-01T09:00:00.000Z",
      },
      {
        workflowId: "wf",
        stepId: "step-2",
        title: "Morning check: Invoices",
        details: "Check unpaid invoices",
        assigneeId: "user",
        dueAt: "2026-10-01T09:00:00.000Z",
      },
    ]);
  });
});
