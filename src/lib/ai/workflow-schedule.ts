export const SCHEDULE_FREQUENCIES = ["daily", "weekdays", "weekly"] as const;
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

export const SCHEDULE_TIME_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
] as const;
export type ScheduleTimeZone = (typeof SCHEDULE_TIME_ZONES)[number];

export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

export type ScheduleInput = {
  frequency: ScheduleFrequency;
  weekday?: number | null;
  timeOfDay: string;
  timeZone: string;
  from: Date;
};

export type WorkflowStepInput = {
  id: string;
  instruction: string;
  agentName: string;
};

export type AssignmentDraft = {
  workflowId: string;
  stepId: string | null;
  title: string;
  details: string;
  assigneeId: string;
  dueAt: string;
};

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
}

function addCalendarDays(year: number, month: number, day: number, offset: number) {
  const shifted = new Date(Date.UTC(year, month - 1, day + offset));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function zonedDateTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(new Date(utc), timeZone);
    const observed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const delta = observed - desired;
    if (delta === 0) break;
    utc -= delta;
  }
  return new Date(utc);
}

function parseTimeOfDay(value: string): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    throw new Error("Time must use HH:MM");
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error("Time must use HH:MM");
  }
  return { hour, minute };
}

export function matchesFrequency(frequency: ScheduleFrequency, weekday: number | null | undefined, localWeekday: number): boolean {
  if (frequency === "daily") return true;
  if (frequency === "weekdays") return localWeekday >= 1 && localWeekday <= 5;
  return localWeekday === weekday;
}

export function nextRunAt(input: ScheduleInput): Date {
  const { hour, minute } = parseTimeOfDay(input.timeOfDay);
  const start = zonedParts(input.from, input.timeZone);
  for (let offset = 0; offset <= 8; offset += 1) {
    const calendar = addCalendarDays(start.year, start.month, start.day, offset);
    const localWeekday = new Date(Date.UTC(calendar.year, calendar.month - 1, calendar.day)).getUTCDay();
    if (!matchesFrequency(input.frequency, input.weekday, localWeekday)) continue;
    const instant = zonedDateTimeToUtc(calendar.year, calendar.month, calendar.day, hour, minute, input.timeZone);
    if (instant.getTime() > input.from.getTime()) return instant;
  }
  throw new Error("Could not find the next run");
}

export function buildAssignmentDrafts(input: {
  workflowId: string;
  workflowName: string;
  steps: WorkflowStepInput[];
  assigneeId: string;
  dueAt: Date;
}): AssignmentDraft[] {
  const dueAt = input.dueAt.toISOString();
  if (input.steps.length === 0) {
    return [
      {
        workflowId: input.workflowId,
        stepId: null,
        title: input.workflowName,
        details: "Scheduled workflow run",
        assigneeId: input.assigneeId,
        dueAt,
      },
    ];
  }

  return input.steps.map((step) => ({
    workflowId: input.workflowId,
    stepId: step.id,
    title: `${input.workflowName}: ${step.agentName}`,
    details: step.instruction,
    assigneeId: input.assigneeId,
    dueAt,
  }));
}
