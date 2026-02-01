import { createServerSupabaseClient } from "@/lib/supabase/server";

type AuditPayload = {
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  details?: Record<string, unknown>;
};

/**
 * Write an audit log entry. Call from server actions or API routes.
 * Only writes if user is authenticated; does not throw.
 */
export async function writeAuditLog(payload: AuditPayload) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: profile } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    await (supabase as any).from("audit_logs").insert({
      organization_id: (profile as { organization_id?: string } | null)?.organization_id ?? null,
      user_id: user.id,
      action: payload.action,
      entity_type: payload.entity_type ?? null,
      entity_id: payload.entity_id ?? null,
      old_values: payload.old_values ?? null,
      new_values: payload.new_values ?? null,
      details: payload.details ?? {},
    });
  } catch {
    // Do not throw; audit is best-effort
  }
}
