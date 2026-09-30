import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
import {
  AgentWorkflowManager,
  type AssignmentView,
  type PersonOption,
  type ScheduleView,
  type WorkflowView,
} from "@/components/admin/agent-workflow-manager";

type StepRow = {
  id: string;
  position: number;
  instruction: string;
  agent_id: string;
  ai_agents?: { name?: string } | { name?: string }[] | null;
};

function relatedName(value: { name?: string } | { name?: string }[] | null | undefined, fallback: string) {
  if (Array.isArray(value)) return value[0]?.name || fallback;
  return value?.name || fallback;
}

export default async function AgentWorkflowsPage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();

  const [{ data: agentRows }, { data: peopleRows }, { data: workflowRows }, { data: assignmentRows }, { data: scheduleRows }] =
    await Promise.all([
      supabase.from("ai_agents").select("id, name, display_order").eq("is_active", true).order("display_order"),
      supabase.from("users").select("id, email, role, status, profiles(name)").in("role", ["super_admin", "staff"]).order("email"),
      supabase
        .from("ai_workflows")
        .select("id, name, description, status, updated_at, ai_workflow_steps(id, position, instruction, agent_id, ai_agents(name))")
        .order("updated_at", { ascending: false }),
      supabase
        .from("ai_task_assignments")
        .select("id, title, details, status, due_at, assignee_id, ai_workflows(name), users!ai_task_assignments_assignee_id_fkey(email, profiles(name))")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("ai_workflow_schedules")
        .select("id, frequency, weekday, time_of_day, timezone, is_active, next_run_at, last_run_at, ai_workflows(name), users!ai_workflow_schedules_assignee_id_fkey(email, profiles(name))")
        .order("next_run_at"),
    ]);

  const people: PersonOption[] = ((peopleRows ?? []) as any[])
    .filter((person) => person.status !== "inactive")
    .map((person) => {
      const profile = Array.isArray(person.profiles) ? person.profiles[0] : person.profiles;
      const name = profile?.name as string | undefined;
      return { id: person.id, label: name ? `${name} (${person.email})` : person.email };
    });

  const workflows: WorkflowView[] = ((workflowRows ?? []) as any[]).map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
    description: workflow.description ?? "",
    status: workflow.status,
    steps: ([...(workflow.ai_workflow_steps ?? [])] as StepRow[])
      .sort((a, b) => a.position - b.position)
      .map((step) => ({
        id: step.id,
        agentId: step.agent_id,
        agentName: relatedName(step.ai_agents, "Agent"),
        instruction: step.instruction,
      })),
  }));

  const assignments: AssignmentView[] = ((assignmentRows ?? []) as any[]).map((row) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const profile = Array.isArray(user?.profiles) ? user.profiles[0] : user?.profiles;
    return {
      id: row.id,
      title: row.title,
      details: row.details ?? "",
      status: row.status,
      dueAt: row.due_at,
      workflowName: relatedName(row.ai_workflows, "Workflow"),
      assigneeLabel: profile?.name || user?.email || "Unassigned",
    };
  });

  const schedules: ScheduleView[] = ((scheduleRows ?? []) as any[]).map((row) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const profile = Array.isArray(user?.profiles) ? user.profiles[0] : user?.profiles;
    return {
      id: row.id,
      workflowName: relatedName(row.ai_workflows, "Workflow"),
      assigneeLabel: profile?.name || user?.email || "Unassigned",
      frequency: row.frequency,
      weekday: row.weekday,
      timeOfDay: String(row.time_of_day),
      timeZone: row.timezone,
      isActive: row.is_active,
      nextRunAt: row.next_run_at,
      lastRunAt: row.last_run_at,
    };
  });

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Agent workflows</h2>
        <p className="mt-1 text-muted-foreground">
          Build a workflow from capability agents, assign the work, and schedule when it runs.{" "}
          <Link href="/dashboard/admin/ai-assistant" className="underline">
            Review the agent catalog
          </Link>
        </p>
      </div>
      <AgentWorkflowManager
        agents={(agentRows ?? []).map((agent: { id: string; name: string }) => ({ id: agent.id, name: agent.name }))}
        people={people}
        workflows={workflows}
        assignments={assignments}
        schedules={schedules}
      />
    </div>
  );
}
