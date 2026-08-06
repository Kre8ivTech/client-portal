import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { ErrorLogList } from "@/components/admin/error-log-list";
import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ErrorLogRecord } from "@/lib/error-logs";

export const metadata: Metadata = {
  title: "Error Log",
  description: "Review and copy captured application errors for issue tracking.",
};

export default async function ErrorLogsPage() {
  await requireRole(["super_admin"]);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("error_logs")
    .select(
      "id, organization_id, user_id, severity, source, message, stack_trace, digest, route, user_agent, environment, release, context, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Error Log</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Review dashboard failures and copy a redacted diagnostic bundle directly into issue tracking.
          </p>
        </div>
      </header>

      <ErrorLogList
        initialLogs={(data ?? []) as ErrorLogRecord[]}
        loadError={error ? "Confirm the error-log migration has been applied, then reload this page." : undefined}
      />
    </div>
  );
}
