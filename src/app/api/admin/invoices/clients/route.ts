import { NextResponse } from "next/server";
import { loadBillableClients, isInvoiceCreator } from "@/lib/invoices/billable-clients";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("id, organization_id, role, is_account_manager")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const creator = profile as {
      id: string;
      organization_id: string | null;
      role: string;
      is_account_manager: boolean;
    };

    if (!isInvoiceCreator(creator)) {
      return NextResponse.json(
        { error: "Forbidden - Account manager access required" },
        { status: 403 },
      );
    }

    const clients = await loadBillableClients(supabase, creator, user.id);
    return NextResponse.json({ data: clients });
  } catch (error) {
    console.error("Failed to list billable clients:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load clients" },
      { status: 500 },
    );
  }
}
