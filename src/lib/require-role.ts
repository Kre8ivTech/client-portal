import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type DashboardRole = "super_admin" | "staff" | "partner" | "partner_staff" | "client";

export type UserProfile = {
  id: string;
  organization_id: string | null;
  role: DashboardRole;
  is_account_manager: boolean;
};

/**
 * Ensures the current user is authenticated and has one of the allowed roles.
 * Redirects to /login if not authenticated, or /dashboard if role is not allowed.
 * Returns { user, profile, role, isAccountManager } for use in the page.
 */
export async function requireRole(allowedRoles: DashboardRole[]) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userRow } = await supabase
    .from("users")
    .select("id, organization_id, role, is_account_manager")
    .eq("id", user.id)
    .single();

  const role = (userRow?.role ?? "client") as DashboardRole;
  const isAccountManager = userRow?.is_account_manager ?? false;

  if (!allowedRoles.includes(role)) {
    redirect("/dashboard");
  }

  return {
    user,
    profile: userRow as UserProfile | null,
    role,
    isAccountManager,
  };
}

/**
 * Checks if user can manage invoices (create, edit, delete).
 * Only super_admin and staff with is_account_manager=true can manage invoices.
 */
export function canManageInvoices(role: DashboardRole, isAccountManager: boolean): boolean {
  return role === "super_admin" || (role === "staff" && isAccountManager);
}

/**
 * Checks if user can view invoices.
 * Staff without account_manager flag cannot view invoices at all.
 * Clients, partners, and partner_staff can view but not manage.
 */
export function canViewInvoices(role: DashboardRole, isAccountManager: boolean): boolean {
  // Staff without account_manager flag cannot see invoices
  if (role === "staff" && !isAccountManager) {
    return false;
  }
  // All other roles can view invoices
  return true;
}

/**
 * Ensures the current user can view invoices.
 * Redirects to /dashboard if they cannot.
 */
export async function requireInvoiceAccess() {
  const { user, profile, role, isAccountManager } = await requireRole([
    "super_admin",
    "staff",
    "partner",
    "partner_staff",
    "client",
  ]);

  if (!canViewInvoices(role, isAccountManager)) {
    redirect("/dashboard");
  }

  return {
    user,
    profile,
    role,
    isAccountManager,
    canManage: canManageInvoices(role, isAccountManager),
  };
}
