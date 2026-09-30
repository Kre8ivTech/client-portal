import { buildAssignmentDrafts, nextRunAt, type ScheduleFrequency } from "@/lib/ai/workflow-schedule";
import { formatAttachmentSummary, toAgentContexts, type AgentSourceRow } from "@/lib/ai/format-agent-context";

type QueryResult<T> = { data: T | null; error: { message: string } | null };

type Db = {
  from: (table: string) => any;
};

type StepAgent = AgentSourceRow & { name?: string };

type StepRow = {
  id: string;
  position: number;
  instruction: string;
  ai_agents?: StepAgent | StepAgent[] | null;
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

function agentRecord(step: StepRow): StepAgent | null {
  const agent = step.ai_agents;
  if (Array.isArray(agent)) return agent[0] ?? null;
  return agent ?? null;
}

function agentName(step: StepRow): string {
  return agentRecord(step)?.name || "Agent";
}

function stepDetails(step: StepRow): string {
  const agent = agentRecord(step);
  const [context] = toAgentContexts([
    {
      name: agent?.name || "Agent",
      href: agent?.href || "",
      instruction: agent?.instruction || "",
      ai_skills: agent?.ai_skills,
      ai_tasks: agent?.ai_tasks,
      ai_agent_connectors: agent?.ai_agent_connectors,
      ai_agent_guardrails: agent?.ai_agent_guardrails,
    },
  ]);
  const summary = formatAttachmentSummary({
    skills: context?.skills ?? [],
    connectors: (context?.connectors ?? []).map((connector) => connector.name),
    guardrails: (context?.guardrails ?? []).map((guardrail) => `${guardrail.name}: ${guardrail.instruction}`),
  });
  return `${step.instruction}\n\n${summary}`;
}

export async function materializeDueSchedules(
  db: Db,
  now: Date,
  options?: { scheduleId?: string; force?: boolean },
): Promise<{ created: number; error?: string }> {
  let query = db
    .from("ai_workflow_schedules")
    .select(
      "id, workflow_id, assignee_id, frequency, weekday, time_of_day, timezone, created_by, ai_workflows(id, name, status, ai_workflow_steps(id, position, instruction, ai_agents(name, href, instruction, ai_skills(name, is_active, display_order), ai_agent_connectors(is_enabled, ai_connectors(name, is_active)), ai_agent_guardrails(is_enabled, ai_guardrails(name, instruction, is_active)))))",
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
          instruction: stepDetails(step),
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
