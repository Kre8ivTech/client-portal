import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
import { AuditLogTable } from "@/components/audit/audit-log-table";

export default async function AuditLogPage() {
  await requireRole(["super_admin"]);

  const supabase = await createServerSupabaseClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, user_id, details, created_at")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          Track sensitive actions. Super admin only. 30-day retention policy.
        </p>
      </div>

      <AuditLogTable initialLogs={logs || []} />
    </div>
  );
}
