import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Disconnect QuickBooks integration
 * DELETE /api/quickbooks/disconnect
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user role and org
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role, is_account_manager, organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Check authorization
    if (
      profile.role !== "super_admin" &&
      !(profile.role === "staff" && profile.is_account_manager)
    ) {
      return NextResponse.json(
        { error: "Only account managers can disconnect QuickBooks" },
        { status: 403 }
      );
    }

    // Delete the integration
    const { error: deleteError } = await supabase
      .from("quickbooks_integrations")
      .delete()
      .eq("organization_id", profile.organization_id);

    if (deleteError) {
      console.error("Error disconnecting QuickBooks:", deleteError);
      return NextResponse.json(
        { error: "Failed to disconnect QuickBooks" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "QuickBooks disconnected successfully",
    });
  } catch (error) {
    console.error("Error disconnecting QuickBooks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
