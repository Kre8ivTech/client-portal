import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/sidebar";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { LiveChatWidget } from "@/components/messaging/live-chat-widget";
import { getPortalBranding } from "@/lib/actions/portal-branding";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  type UserRow = { id: string; organization_id: string | null; email: string; role: string; is_account_manager: boolean };
  type ProfileRow = { id: string; name: string | null; avatar_url: string | null; organization_name: string | null; organization_slug: string | null };
  type DashboardProfile = {
    id: string;
    organization_id: string | null;
    email: string;
    role: "super_admin" | "staff" | "partner" | "partner_staff" | "client";
    is_account_manager: boolean;
    name: string | null;
    avatar_url: string | null;
    organization_name: string | null;
    organization_slug: string | null;
  };

  let [
    { data: userData, error: userError },
    { data: profileData, error: profileError },
    branding,
  ] = await Promise.all([
    supabase.from("users").select("id, organization_id, email, role, is_account_manager").eq("id", user.id).single(),
    supabase.from("user_profiles").select("id, name, avatar_url, organization_name, organization_slug").eq("id", user.id).single(),
    getPortalBranding(),
  ]);
  let userRow = userData as UserRow | null;
  let profileRow = profileData as ProfileRow | null;
  
  const isStaffOrAdmin = userRow?.role === "staff" || userRow?.role === "super_admin";
  const orgId = userRow?.organization_id;
  
  const [{ data: recentTickets }, { data: planAssignments }] = isStaffOrAdmin && orgId
    ? await Promise.all([
        supabase
          .from("tickets")
          .select("id, ticket_number, subject")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("plan_assignments")
          .select("id, plans(name), organizations(name)")
          .eq("status", "active")
          .limit(20),
      ])
    : [{ data: null }, { data: null }];

  const normalizedPlanAssignments =
    (planAssignments ?? []).map((pa: any) => ({
      id: pa.id,
      plans: Array.isArray(pa.plans) ? pa.plans[0] ?? null : pa.plans ?? null,
      organizations: Array.isArray(pa.organizations)
        ? pa.organizations[0] ?? null
        : pa.organizations ?? null,
    })) ?? [];

  // Backfill if auth user has no public.users/public.profiles row (e.g. trigger failed or pre-migration user)
  if ((userError?.code === "PGRST116" || !userRow) && user?.email) {
    await (supabase as any)
      .from("users")
      .upsert(
        { id: user.id, email: user.email, role: "client", status: "active" },
        { onConflict: "id" },
      );
    await (supabase as any)
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          name: (user.user_metadata?.name as string) ?? user.email?.split("@")[0] ?? null,
          avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
        },
        { onConflict: "user_id" },
      );
    const [userRes, profileRes] = await Promise.all([
      supabase.from("users").select("id, organization_id, email, role, is_account_manager").eq("id", user.id).single(),
      supabase.from("user_profiles").select("id, name, avatar_url, organization_name, organization_slug").eq("id", user.id).single(),
    ]);
    userRow = userRes.data as UserRow | null;
    profileRow = profileRes.data as ProfileRow | null;
  }

  const profile: DashboardProfile | null =
    userRow && profileRow
      ? {
          id: userRow.id,
          organization_id: userRow.organization_id ?? null,
          email: userRow.email,
          role: (userRow.role as DashboardProfile["role"]) ?? "client",
          is_account_manager: userRow.is_account_manager ?? false,
          name: profileRow.name ?? null,
          avatar_url: profileRow.avatar_url ?? null,
          organization_name: profileRow.organization_name ?? null,
          organization_slug: profileRow.organization_slug ?? null,
        }
      : null;
  if ((userError || profileError) && !userRow && process.env.NODE_ENV === "development") {
    console.warn(
      "[Dashboard] Profile fetch failed — sidebar may show limited nav. RLS or missing row?",
      userError?.message ?? profileError?.message,
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar profile={profile} branding={branding} />

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <DashboardTopbar 
          user={{ email: user.email }} 
          profile={profile}
          tickets={recentTickets ?? []}
          planAssignments={normalizedPlanAssignments}
        />
        <main className="p-6 flex-1 overflow-auto">{children}</main>
      </div>

      <LiveChatWidget />
    </div>
  );
}
