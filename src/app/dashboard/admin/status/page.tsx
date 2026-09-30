import Link from "next/link";
import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatusIncidentManager, type StatusIncidentView } from "@/components/admin/status-incidents";

export default async function AdminStatusPage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("status_incidents")
    .select("id, title, body, severity, status, started_at")
    .order("started_at", { ascending: false })
    .limit(30);

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Status</h2>
        <p className="mt-1 text-muted-foreground">
          Incidents posted here appear on the public{" "}
          <Link href="/status" className="underline">
            status page
          </Link>
          .
        </p>
      </div>
      <StatusIncidentManager incidents={(data ?? []) as StatusIncidentView[]} />
    </div>
  );
}
