import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get admin's profile and role
    const { data: userData } = await (supabase as any)
      .from("users")
      .select("id, email, role, organization_id")
      .eq("id", user.id)
      .single();

    const adminProfile = userData as { id: string; email: string; role: string; organization_id: string | null };

    if (!adminProfile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Check if user has admin/staff privileges
    const isStaffOrAdmin = adminProfile.role === "staff" || adminProfile.role === "super_admin";
    if (!isStaffOrAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    // Get target user
    const { data: targetUserData } = await (supabase as any)
      .from("users")
      .select("id, email, organization_id")
      .eq("id", id)
      .single();

    const targetUser = targetUserData as { id: string; email: string; organization_id: string | null } | null;

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check organization access (non-super_admin can only reset passwords for users in their org)
    if (adminProfile.role !== "super_admin") {
      if (targetUser.organization_id !== adminProfile.organization_id) {
        return NextResponse.json(
          { error: "Forbidden - Can only manage users in your organization" },
          { status: 403 }
        );
      }
    }

    // Use Supabase Admin API to send password reset email
    // Note: This requires SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase admin credentials");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Send password reset email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const { error: resetError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: targetUser.email,
      options: {
        redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
      },
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      return NextResponse.json(
        { error: "Failed to send password reset email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Password reset email sent to ${targetUser.email}`,
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
