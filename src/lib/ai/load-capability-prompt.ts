import { createClient } from "@supabase/supabase-js";
import { buildCapabilityPrompt, normalizeAiRole, type AiRole } from "@/lib/ai/capability-catalog";

type SkillRow = { name?: string; display_order?: number };
type TaskRow = { starter_prompt?: string; display_order?: number };
type AgentRow = {
  name: string;
  instruction: string;
  href: string;
  roles: string[] | null;
  display_order?: number;
  ai_skills?: SkillRow[] | null;
  ai_tasks?: TaskRow[] | null;
};

function formatRows(rows: AgentRow[]): string {
  const lines = [
    "[Capability agents]",
    "You can help only with the capabilities listed below. Each capability has an agent, skills, and tasks.",
    "Answer using that agent's instruction, name the matching page, and do not describe capabilities missing from this list.",
    "Do not invent account data, payment results, campaign metrics, or secrets.",
    "",
  ];

  for (const agent of rows) {
    const skills = [...(agent.ai_skills ?? [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const tasks = [...(agent.ai_tasks ?? [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    lines.push(`Agent: ${agent.name} (${agent.href})`);
    lines.push(`Instruction: ${agent.instruction}`);
    lines.push(`Skills: ${skills.map((skill) => skill.name).filter(Boolean).join(", ")}`);
    lines.push(`Tasks: ${tasks.map((task) => task.starter_prompt).filter(Boolean).join(" | ")}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

export async function capabilityPromptForRole(role: string | null | undefined): Promise<string> {
  const fallback = buildCapabilityPrompt(role);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fallback;

  try {
    const admin = createClient(url, key);
    const { data, error } = await admin
      .from("ai_agents")
      .select("name, instruction, href, roles, display_order, ai_skills(name, display_order), ai_tasks(starter_prompt, display_order)")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error || !data?.length) return fallback;

    const normalized: AiRole = normalizeAiRole(role);
    const visible = (data as AgentRow[])
      .filter((agent) => Array.isArray(agent.roles) && agent.roles.includes(normalized))
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

    if (!visible.length) return fallback;
    return formatRows(visible);
  } catch {
    return fallback;
  }
}
