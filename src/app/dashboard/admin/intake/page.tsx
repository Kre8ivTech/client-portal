import Link from "next/link";
import { requireRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type InboundRow = {
  id: string;
  source: string;
  email: string;
  name: string | null;
  subject: string;
  ticket_id: string | null;
  created_at: string;
};

export default async function IntakePage() {
  await requireRole(["super_admin", "staff"]);
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("inbound_requests")
    .select("id, source, email, name, subject, ticket_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as InboundRow[];

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Website and email intake</h2>
        <p className="mt-1 max-w-3xl text-muted-foreground">
          kre8ivtech.com posts project requests and call bookings to <code>POST /api/intake/website</code>. Inbound mail
          posts to <code>POST /api/intake/email</code>. Send the shared secret as <code>Authorization: Bearer</code> or{" "}
          <code>x-intake-secret</code>. Set <code>INTAKE_WEBHOOK_SECRET</code>. Optional{" "}
          <code>INTAKE_ORGANIZATION_ID</code> receives requests from people who do not already have a portal login.
          A reply whose subject contains <code>#123</code> is added to that ticket.
        </p>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No requests have arrived yet.</p> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border p-4">
            <p className="font-medium">{row.subject}</p>
            <p className="text-sm text-muted-foreground">
              {row.source} · {row.name || row.email} · {new Date(row.created_at).toLocaleString()}
            </p>
            {row.ticket_id ? (
              <Link href={`/dashboard/tickets/${row.ticket_id}`} className="text-sm underline">
                Open ticket
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
