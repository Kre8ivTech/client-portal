import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type DashboardRole = "super_admin" | "staff" | "partner" | "partner_staff" | "client";

/**
 * Ensures the current user is authenticated and has one of the allowed roles.
 * Redirects to /login if not authenticated, or /dashboard if role is not allowed.
 * Returns { user, profile, role } for use in the page.
 */
export async function requireRole(allowedRoles: DashboardRole[]) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, name, role")
    .eq("id", user.id)
    .single();

  type ProfileRow = { id: string; organization_id: string | null; name: string | null; role: string };
  const role = (profile as ProfileRow | null)?.role ?? "client";

  if (!allowedRoles.includes(role as DashboardRole)) {
    redirect("/dashboard");
  }

  return { user, profile, role: role as DashboardRole };
}
