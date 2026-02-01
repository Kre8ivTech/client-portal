import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

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
          Track sensitive actions. Super admin only. Last 30 days (retention per PRD).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Actions
          </CardTitle>
          <CardDescription>
            Filterable, exportable audit log for security and compliance. Use writeAuditLog() in actions to record events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!logs?.length ? (
            <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-8 text-center text-muted-foreground text-sm">
              No audit entries yet. Audit events are written when sensitive actions occur (e.g. role change, settings update).
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.entity_type && log.entity_id
                        ? `${log.entity_type} ${log.entity_id.slice(0, 8)}…`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {log.user_id ? `${log.user_id.slice(0, 8)}…` : "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs text-muted-foreground">
                      {typeof log.details === "object" && log.details !== null
                        ? JSON.stringify(log.details).slice(0, 60) + "…"
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
