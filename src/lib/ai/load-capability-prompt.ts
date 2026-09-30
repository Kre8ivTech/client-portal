import { createClient } from "@supabase/supabase-js";
import { buildCapabilityPrompt, normalizeAiRole, type AiRole } from "@/lib/ai/capability-catalog";
import { formatAgentContexts, toAgentContexts, type AgentSourceRow } from "@/lib/ai/format-agent-context";

type AgentRow = AgentSourceRow & {
  roles: string[] | null;
};

const AGENT_SELECT = [
  "name",
  "instruction",
  "href",
  "roles",
  "display_order",
  "ai_skills(name, display_order, is_active)",
  "ai_tasks(starter_prompt, display_order, is_active)",
  "ai_agent_connectors(is_enabled, ai_connectors(name, description, is_active))",
  "ai_agent_guardrails(is_enabled, ai_guardrails(name, instruction, is_active))",
].join(", ");

export async function capabilityPromptForRole(role: string | null | undefined): Promise<string> {
  const fallback = buildCapabilityPrompt(role);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fallback;

  try {
    const admin = createClient(url, key);
    const { data, error } = await admin
      .from("ai_agents")
      .select(AGENT_SELECT)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error || !data?.length) return fallback;

    const normalized: AiRole = normalizeAiRole(role);
    const visible = (data as unknown as AgentRow[]).filter((agent) => Array.isArray(agent.roles) && agent.roles.includes(normalized));
    if (!visible.length) return fallback;
    return formatAgentContexts(toAgentContexts(visible));
  } catch {
    return fallback;
  }
}
