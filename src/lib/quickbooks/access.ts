import { NextResponse } from "next/server";
import { canCreateInvoices, normalizeDashboardRole } from "@/lib/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type QuickBooksActor = {
  userId: string;
  organizationId: string;
  role: string;
  isAccountManager: boolean;
};

export function canManageQuickBooks(role: string, isAccountManager: boolean): boolean {
  return canCreateInvoices(normalizeDashboardRole(role), isAccountManager);
}

export async function requireQuickBooksManager(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; actor: QuickBooksActor }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, is_account_manager, organization_id")
    .eq("id", user.id)
    .single();

  const row = profile as {
    role: string;
    is_account_manager: boolean;
    organization_id: string | null;
  } | null;

  if (!row) {
    return { ok: false, response: NextResponse.json({ error: "User profile not found" }, { status: 404 }) };
  }

  if (!row.organization_id || !canManageQuickBooks(row.role, row.is_account_manager)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Only account managers can manage QuickBooks" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    supabase,
    actor: {
      userId: user.id,
      organizationId: row.organization_id,
      role: row.role,
      isAccountManager: row.is_account_manager,
    },
  };
}
