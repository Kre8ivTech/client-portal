"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
import { slugFromName } from "@/lib/ai/attachment-slug";

const PATH = "/dashboard/admin/agents";

const skillSchema = z.object({
  agentId: z.string().uuid(),
  name: z.string().trim().min(2, "Skill name must be at least 2 characters").max(80),
  description: z.string().trim().min(3, "Add a short description").max(500),
});

const connectorSchema = z.object({
  agentId: z.string().uuid(),
  connectorId: z.string().uuid(),
});

const guardrailAttachSchema = z.object({
  agentId: z.string().uuid(),
  guardrailId: z.string().uuid(),
});

const guardrailCreateSchema = z.object({
  agentId: z.string().uuid(),
  name: z.string().trim().min(2, "Guardrail name must be at least 2 characters").max(80),
  instruction: z.string().trim().min(8, "Write the rule the agent must follow").max(500),
  severity: z.enum(["block", "warn"]),
});

function failure(error: z.ZodError | { message: string }) {
  if ("issues" in error) {
    return { success: false as const, error: error.issues[0]?.message || "Check the form and try again" };
  }
  return { success: false as const, error: error.message };
}

function isUniqueViolation(error: { code?: string; message?: string }) {
  return error.code === "23505" || /duplicate key/i.test(error.message || "");
}

async function nextSkillOrder(agentId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("ai_skills")
    .select("display_order")
    .eq("agent_id", agentId)
    .order("display_order", { ascending: false })
    .limit(1);
  const current = (data?.[0] as { display_order?: number } | undefined)?.display_order ?? 0;
  return current + 1;
}

export async function addAgentSkill(input: z.input<typeof skillSchema>) {
  await requireRole(["super_admin", "staff"]);
  const parsed = skillSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error);

  const supabase = await createServerSupabaseClient();
  const displayOrder = await nextSkillOrder(parsed.data.agentId);
  const { error } = await supabase.from("ai_skills").insert({
    agent_id: parsed.data.agentId,
    slug: slugFromName(parsed.data.name),
    name: parsed.data.name,
    description: parsed.data.description,
    display_order: displayOrder,
    is_active: true,
  });
  if (error) {
    if (isUniqueViolation(error)) return failure({ message: "That skill already exists on this agent" });
    return failure(error);
  }

  revalidatePath(PATH);
  return { success: true as const };
}

export async function removeAgentSkill(skillId: string) {
  await requireRole(["super_admin", "staff"]);
  const parsed = z.string().uuid().safeParse(skillId);
  if (!parsed.success) return failure({ message: "Choose a skill to remove" });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("ai_skills").delete().eq("id", parsed.data);
  if (error) return failure(error);

  revalidatePath(PATH);
  return { success: true as const };
}

export async function addAgentConnector(input: z.input<typeof connectorSchema>) {
  await requireRole(["super_admin", "staff"]);
  const parsed = connectorSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("ai_agent_connectors").insert({
    agent_id: parsed.data.agentId,
    connector_id: parsed.data.connectorId,
    is_enabled: true,
  });
  if (error) {
    if (isUniqueViolation(error)) return failure({ message: "That connector is already on this agent" });
    return failure(error);
  }

  revalidatePath(PATH);
  return { success: true as const };
}

export async function removeAgentConnector(attachmentId: string) {
  await requireRole(["super_admin", "staff"]);
  const parsed = z.string().uuid().safeParse(attachmentId);
  if (!parsed.success) return failure({ message: "Choose a connector to remove" });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("ai_agent_connectors").delete().eq("id", parsed.data);
  if (error) return failure(error);

  revalidatePath(PATH);
  return { success: true as const };
}

export async function attachAgentGuardrail(input: z.input<typeof guardrailAttachSchema>) {
  await requireRole(["super_admin", "staff"]);
  const parsed = guardrailAttachSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("ai_agent_guardrails").insert({
    agent_id: parsed.data.agentId,
    guardrail_id: parsed.data.guardrailId,
    is_enabled: true,
  });
  if (error) {
    if (isUniqueViolation(error)) return failure({ message: "That guardrail is already on this agent" });
    return failure(error);
  }

  revalidatePath(PATH);
  return { success: true as const };
}

export async function addAgentGuardrail(input: z.input<typeof guardrailCreateSchema>) {
  await requireRole(["super_admin", "staff"]);
  const parsed = guardrailCreateSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ai_guardrails")
    .insert({
      slug: slugFromName(parsed.data.name),
      name: parsed.data.name,
      instruction: parsed.data.instruction,
      severity: parsed.data.severity,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) {
    if (isUniqueViolation(error)) {
      return failure({ message: "A guardrail with that name already exists. Attach it from the library." });
    }
    return failure(error);
  }

  const attached = await attachAgentGuardrail({
    agentId: parsed.data.agentId,
    guardrailId: (data as { id: string }).id,
  });
  if (!attached.success) return attached;
  return { success: true as const };
}

export async function removeAgentGuardrail(attachmentId: string) {
  await requireRole(["super_admin", "staff"]);
  const parsed = z.string().uuid().safeParse(attachmentId);
  if (!parsed.success) return failure({ message: "Choose a guardrail to remove" });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("ai_agent_guardrails").delete().eq("id", parsed.data);
  if (error) return failure(error);

  revalidatePath(PATH);
  return { success: true as const };
}
