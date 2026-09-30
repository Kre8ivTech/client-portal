import { buildAssignmentDrafts, nextRunAt, type ScheduleFrequency } from "@/lib/ai/workflow-schedule";

type QueryResult<T> = { data: T | null; error: { message: string } | null };

type Db = {
  from: (table: string) => any;
};

type StepRow = {
  id: string;
  position: number;
  instruction: string;
  ai_agents?: { name?: string } | { name?: string }[] | null;
};

type ScheduleRow = {
  id: string;
  workflow_id: string;
  assignee_id: string;
  frequency: ScheduleFrequency;
  weekday: number | null;
  time_of_day: string;
  timezone: string;
  created_by: string | null;
  ai_workflows?: {
    id: string;
    name: string;
    status: string;
    ai_workflow_steps?: StepRow[] | null;
  } | null;
};

function agentName(step: StepRow): string {
  const agent = step.ai_agents;
  if (Array.isArray(agent)) return agent[0]?.name || "Agent";
  return agent?.name || "Agent";
}

export async function materializeDueSchedules(
  db: Db,
  now: Date,
  options?: { scheduleId?: string; force?: boolean },
): Promise<{ created: number; error?: string }> {
  let query = db
    .from("ai_workflow_schedules")
    .select(
      "id, workflow_id, assignee_id, frequency, weekday, time_of_day, timezone, created_by, ai_workflows(id, name, status, ai_workflow_steps(id, position, instruction, ai_agents(name)))",
    )
    .eq("is_active", true);

  if (options?.scheduleId) {
    query = query.eq("id", options.scheduleId);
  } else {
    query = query.lte("next_run_at", now.toISOString());
  }

  const { data, error } = (await query) as QueryResult<ScheduleRow[]>;
  if (error) return { created: 0, error: error.message };

  let created = 0;
  for (const schedule of data ?? []) {
    const workflow = schedule.ai_workflows;
    const next = nextRunAt({
      frequency: schedule.frequency,
      weekday: schedule.weekday,
      timeOfDay: String(schedule.time_of_day).slice(0, 5),
      timeZone: schedule.timezone,
      from: now,
    });

    if (workflow?.status === "active") {
      const steps = [...(workflow.ai_workflow_steps ?? [])].sort((a, b) => a.position - b.position);
      const drafts = buildAssignmentDrafts({
        workflowId: workflow.id,
        workflowName: workflow.name,
        assigneeId: schedule.assignee_id,
        dueAt: now,
        steps: steps.map((step) => ({
          id: step.id,
          instruction: step.instruction,
          agentName: agentName(step),
        })),
      });

      if (drafts.length > 0) {
        const { error: insertError } = await db.from("ai_task_assignments").insert(
          drafts.map((draft) => ({
            workflow_id: draft.workflowId,
            step_id: draft.stepId,
            title: draft.title,
            details: draft.details,
            assignee_id: draft.assigneeId,
            due_at: draft.dueAt,
            status: "open",
            schedule_id: schedule.id,
            created_by: schedule.created_by,
          })),
        );
        if (insertError) return { created, error: insertError.message };
        created += drafts.length;
      }
    }

    const { error: updateError } = await db
      .from("ai_workflow_schedules")
      .update({ last_run_at: now.toISOString(), next_run_at: next.toISOString() })
      .eq("id", schedule.id);
    if (updateError) return { created, error: updateError.message };
  }

  return { created };
}
