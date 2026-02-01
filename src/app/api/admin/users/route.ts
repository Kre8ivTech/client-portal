import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's profile and role
    const { data: userData } = await (supabase as any)
      .from("users")
      .select("id, email, role, organization_id")
      .eq("id", user.id)
      .single();

    const profile = userData as { id: string; email: string; role: string; organization_id: string | null };

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Check if user has admin/staff privileges
    const isStaffOrAdmin = profile.role === "staff" || profile.role === "super_admin";
    if (!isStaffOrAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const role = url.searchParams.get("role");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build query
    let query = (supabase as any)
      .from("users")
      .select(`
        id,
        email,
        role,
        organization_id,
        created_at,
        user_profiles!inner (
          name,
          avatar_url,
          organization_name,
          organization_slug
        )
      `, { count: 'exact' });

    // Filter by organization for non-super_admin users
    if (profile.role !== "super_admin" && profile.organization_id) {
      query = query.eq("organization_id", profile.organization_id);
    }

    // Apply filters
    if (search) {
      query = query.or(`email.ilike.%${search}%,user_profiles.name.ilike.%${search}%`);
    }

    if (role && role !== "all") {
      query = query.eq("role", role);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1).order("created_at", { ascending: false });

    const { data: users, error, count } = await query;

    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      users: users || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in users API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
