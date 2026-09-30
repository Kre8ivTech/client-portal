import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Incident = {
  id: string;
  title: string;
  body: string;
  severity: string;
  status: string;
  started_at: string;
  resolved_at: string | null;
};

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const admin = getSupabaseAdmin();
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const { data } = await admin
    .from("status_incidents")
    .select("id, title, body, severity, status, started_at, resolved_at")
    .eq("is_public", true)
    .order("started_at", { ascending: false })
    .limit(40);

  const incidents = ((data ?? []) as Incident[]).filter(
    (incident) => incident.status !== "resolved" || (incident.resolved_at != null && new Date(incident.resolved_at).getTime() >= since),
  );
  const open = incidents.filter((incident) => incident.status !== "resolved");

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-4 py-12">
      <div>
        <p className="text-sm text-muted-foreground">Kre8ivTech</p>
        <h1 className="text-3xl font-bold tracking-tight">{open.length ? "Some services need attention" : "All services operational"}</h1>
        <p className="mt-2 text-muted-foreground">This page lists public maintenance and outages for client sites and the portal.</p>
      </div>
      {incidents.length === 0 ? <p>No incidents in the last 7 days.</p> : null}
      <ul className="space-y-4">
        {incidents.map((incident) => (
          <li key={incident.id} className="space-y-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{incident.title}</h2>
              <p className="text-sm capitalize">
                {incident.severity} · {incident.status}
              </p>
            </div>
            <p className="whitespace-pre-wrap text-sm">{incident.body}</p>
            <p className="text-xs text-muted-foreground">Started {new Date(incident.started_at).toLocaleString()}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        <Link href="/login" className="underline">
          Sign in to the portal
        </Link>
      </p>
    </main>
  );
}
