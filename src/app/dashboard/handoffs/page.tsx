import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
import { HandoffManager, type HandoffView } from "@/components/handoffs/handoff-manager";

export default async function HandoffsPage() {
  const { role } = await requireRole(["super_admin", "staff", "partner", "partner_staff", "client"]);
  const supabase = await createServerSupabaseClient();
  const canManage = role === "super_admin" || role === "staff";
  const [{ data: rows }, orgs] = await Promise.all([
    supabase
      .from("client_handoffs")
      .select("id, title, summary, live_url, owner_name, update_notes, organizations(name)")
      .order("created_at", { ascending: false }),
    canManage ? supabase.from("organizations").select("id, name").order("name").limit(200) : Promise.resolve({ data: [] }),
  ]);

  const handoffs: HandoffView[] = ((rows ?? []) as any[]).map((row) => {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      liveUrl: row.live_url,
      ownerName: row.owner_name,
      updateNotes: row.update_notes,
      organizationName: org?.name || "",
    };
  });

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Handoffs</h2>
        <p className="mt-1 text-muted-foreground">What shipped, where it lives, and who owns updates after launch.</p>
      </div>
      <HandoffManager
        handoffs={handoffs}
        canManage={canManage}
        organizations={((orgs.data ?? []) as { id: string; name: string }[])}
      />
    </div>
  );
}
