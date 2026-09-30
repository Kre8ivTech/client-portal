import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
import {
  AgentWorkflowManager,
  type AgentOption,
  type AssignmentView,
  type PersonOption,
  type ScheduleView,
  type WorkflowView,
} from "@/components/admin/agent-workflow-manager";
import type {
  AgentSetupView,
  CatalogConnector,
  CatalogGuardrail,
} from "@/components/admin/agent-attachments";

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

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function AgentWorkflowsPage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();

  const [
    { data: agentRows },
    { data: connectorRows },
    { data: guardrailRows },
    { data: peopleRows },
    { data: workflowRows },
    { data: assignmentRows },
    { data: scheduleRows },
  ] = await Promise.all([
      supabase
        .from("ai_agents")
        .select(
          "id, name, display_order, ai_skills(id, name, description, is_active, display_order), ai_agent_connectors(id, is_enabled, ai_connectors(id, name, description)), ai_agent_guardrails(id, is_enabled, ai_guardrails(id, name, instruction, severity))",
        )
        .eq("is_active", true)
        .order("display_order"),
      supabase.from("ai_connectors").select("id, name, description").eq("is_active", true).order("name"),
      supabase.from("ai_guardrails").select("id, name, instruction, severity").eq("is_active", true).order("name"),
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

  const setupAgents: AgentSetupView[] = ((agentRows ?? []) as any[]).map((agent) => {
    const skills = ([...(agent.ai_skills ?? [])] as any[])
      .filter((skill) => skill.is_active !== false)
      .sort((left, right) => (left.display_order ?? 0) - (right.display_order ?? 0))
      .map((skill) => ({ id: skill.id, name: skill.name, description: skill.description }));
    const connectors = ((agent.ai_agent_connectors ?? []) as any[])
      .filter((link) => link.is_enabled !== false)
      .map((link) => {
        const connector = one<{ id: string; name: string; description: string }>(link.ai_connectors);
        if (!connector) return null;
        return { id: link.id, connectorId: connector.id, name: connector.name, description: connector.description };
      })
      .filter((connector): connector is AgentSetupView["connectors"][number] => connector != null);
    const guardrails = ((agent.ai_agent_guardrails ?? []) as any[])
      .filter((link) => link.is_enabled !== false)
      .map((link) => {
        const guardrail = one<AgentSetupView["guardrails"][number]>(link.ai_guardrails);
        if (!guardrail?.name) return null;
        return {
          id: link.id,
          guardrailId: guardrail.id,
          name: guardrail.name,
          instruction: guardrail.instruction,
          severity: guardrail.severity === "warn" ? "warn" : "block",
        };
      })
      .filter((guardrail): guardrail is AgentSetupView["guardrails"][number] => guardrail != null);
    return { id: agent.id, name: agent.name, skills, connectors, guardrails };
  });

  const agentOptions: AgentOption[] = setupAgents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    skills: agent.skills.map((skill) => skill.name),
    connectors: agent.connectors.map((connector) => connector.name),
    guardrails: agent.guardrails.map((guardrail) => guardrail.name),
  }));

  const connectorCatalog: CatalogConnector[] = ((connectorRows ?? []) as CatalogConnector[]).map((connector) => ({
    id: connector.id,
    name: connector.name,
    description: connector.description,
  }));

  const guardrailCatalog: CatalogGuardrail[] = ((guardrailRows ?? []) as any[]).map((guardrail) => ({
    id: guardrail.id,
    name: guardrail.name,
    instruction: guardrail.instruction,
    severity: guardrail.severity === "warn" ? "warn" : "block",
  }));

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
          Build a workflow from capability agents, assign the work, and schedule when it runs. Add skills, connectors, and guardrails on Agent setup.{" "}
          <Link href="/dashboard/admin/ai-assistant" className="underline">
            Review the agent catalog
          </Link>
        </p>
      </div>
      <AgentWorkflowManager
        agents={agentOptions}
        setupAgents={setupAgents}
        connectorCatalog={connectorCatalog}
        guardrailCatalog={guardrailCatalog}
        people={people}
        workflows={workflows}
        assignments={assignments}
        schedules={schedules}
      />
    </div>
  );
}
