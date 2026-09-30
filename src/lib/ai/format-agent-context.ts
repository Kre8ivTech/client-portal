export type AgentContext = {
  name: string;
  href: string;
  instruction: string;
  skills: string[];
  connectors: Array<{ name: string; description?: string }>;
  guardrails: Array<{ name: string; instruction: string }>;
  tasks: string[];
};

type NamedRow = {
  name?: string | null;
  description?: string | null;
  instruction?: string | null;
  starter_prompt?: string | null;
  display_order?: number | null;
  is_active?: boolean | null;
};

export type AgentSourceRow = {
  name: string;
  instruction: string;
  href: string;
  display_order?: number | null;
  ai_skills?: NamedRow[] | null;
  ai_tasks?: NamedRow[] | null;
  ai_agent_connectors?: Array<{
    is_enabled?: boolean | null;
    ai_connectors?: NamedRow | NamedRow[] | null;
  }> | null;
  ai_agent_guardrails?: Array<{
    is_enabled?: boolean | null;
    ai_guardrails?: NamedRow | NamedRow[] | null;
  }> | null;
};

function rowsOf<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function byOrder(left: NamedRow, right: NamedRow) {
  return (left.display_order ?? 0) - (right.display_order ?? 0);
}

export function toAgentContexts(rows: AgentSourceRow[]): AgentContext[] {
  return [...rows]
    .sort((left, right) => (left.display_order ?? 0) - (right.display_order ?? 0))
    .map((agent) => ({
      name: agent.name,
      href: agent.href,
      instruction: agent.instruction,
      skills: [...(agent.ai_skills ?? [])]
        .filter((skill) => skill.is_active !== false && skill.name)
        .sort(byOrder)
        .map((skill) => skill.name as string),
      connectors: (agent.ai_agent_connectors ?? [])
        .filter((link) => link.is_enabled !== false)
        .flatMap((link) => rowsOf(link.ai_connectors))
        .filter((connector) => connector.is_active !== false && connector.name)
        .map((connector) => ({
          name: connector.name as string,
          description: connector.description || undefined,
        })),
      guardrails: (agent.ai_agent_guardrails ?? [])
        .filter((link) => link.is_enabled !== false)
        .flatMap((link) => rowsOf(link.ai_guardrails))
        .filter((guardrail) => guardrail.is_active !== false && guardrail.name && guardrail.instruction)
        .map((guardrail) => ({
          name: guardrail.name as string,
          instruction: guardrail.instruction as string,
        })),
      tasks: [...(agent.ai_tasks ?? [])]
        .filter((task) => task.is_active !== false && task.starter_prompt)
        .sort(byOrder)
        .map((task) => task.starter_prompt as string),
    }));
}

export function formatAttachmentSummary(input: {
  skills: string[];
  connectors: string[];
  guardrails: string[];
}): string {
  return [
    `Skills: ${input.skills.filter(Boolean).join(", ") || "None"}`,
    `Connectors: ${input.connectors.filter(Boolean).join(", ") || "None"}`,
    `Guardrails: ${input.guardrails.filter(Boolean).join(", ") || "None"}`,
  ].join("\n");
}

export function formatAgentContexts(agents: AgentContext[]): string {
  const lines = [
    "[Capability agents]",
    "You can help only with the capabilities listed below.",
    "Use that agent's skills, only the connectors listed for it, and follow its guardrails.",
    "Do not use a connector or describe a capability that is missing from this list.",
    "",
  ];

  for (const agent of agents) {
    lines.push(`Agent: ${agent.name} (${agent.href})`);
    lines.push(`Instruction: ${agent.instruction}`);
    lines.push(`Skills: ${agent.skills.filter(Boolean).join(", ") || "None"}`);
    lines.push(
      `Connectors: ${
        agent.connectors.length
          ? agent.connectors.map((connector) => connector.name).join(", ")
          : "None"
      }`,
    );
    lines.push(
      agent.guardrails.length
        ? `Guardrails: ${agent.guardrails.map((guardrail) => `${guardrail.name}: ${guardrail.instruction}`).join(" | ")}`
        : "Guardrails: None",
    );
    lines.push(`Tasks: ${agent.tasks.filter(Boolean).join(" | ") || "None"}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}
