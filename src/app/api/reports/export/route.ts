import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  const role = (profile as { role?: string } | null)?.role ?? "client";
  if (role !== "super_admin" && role !== "staff" && role !== "partner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  const since = fromParam ? new Date(fromParam).toISOString() : defaultStart.toISOString();
  const until = toParam ? new Date(toParam).toISOString() : defaultEnd.toISOString();

  const orgId = (profile as { organization_id?: string } | null)?.organization_id ?? null;

  const ticketsQuery = supabase
    .from("tickets")
    .select("id, status, priority", { count: "exact" })
    .gte("created_at", since)
    .lte("created_at", until);

  if (role === "partner" && orgId) {
    const { data: childOrgs } = await supabase.from("organizations").select("id").eq("parent_org_id", orgId);
    const childIds = (childOrgs ?? []).map((o: { id: string }) => o.id);
    if (childIds.length) ticketsQuery.in("organization_id", childIds);
    else ticketsQuery.eq("organization_id", orgId);
  }

  const { count: totalTickets } = await ticketsQuery;

  type OrgRow = { id: string; name: string };
  const partnerVolume: { org_name: string; count: number }[] = [];

  if (role === "super_admin" || role === "staff") {
    const { data: orgs } = await supabase.from("organizations").select("id, name").eq("type", "partner");
    for (const org of (orgs ?? []) as OrgRow[]) {
      const { data: children } = await supabase.from("organizations").select("id").eq("parent_org_id", org.id);
      const childIds = (children ?? []).map((c: { id: string }) => c.id);
      if (childIds.length === 0) continue;
      const { count } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .in("organization_id", childIds)
        .gte("created_at", since)
        .lte("created_at", until);
      partnerVolume.push({ org_name: org.name, count: count ?? 0 });
    }
  } else if (role === "partner" && orgId) {
    const { data: children } = await supabase.from("organizations").select("id, name").eq("parent_org_id", orgId);
    for (const child of (children ?? []) as OrgRow[]) {
      const { count } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", child.id)
        .gte("created_at", since)
        .lte("created_at", until);
      partnerVolume.push({ org_name: child.name, count: count ?? 0 });
    }
  }

  const rows: string[] = [
    "Report,Value",
    `Total Tickets (${fromParam ?? "from"} to ${toParam ?? "to"}),${totalTickets ?? 0}`,
    "",
    "Organization,Ticket Count",
    ...partnerVolume.map((p) => `${escapeCsv(p.org_name)},${p.count}`),
  ];

  const csv = rows.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reports-${fromParam ?? "from"}-${toParam ?? "to"}.csv"`,
    },
  });
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
