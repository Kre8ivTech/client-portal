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

    // Build query - query user_profiles view directly which includes everything
    let query = (supabase as any)
      .from("user_profiles")
      .select(`
        id,
        name,
        avatar_url,
        organization_name,
        organization_slug
      `, { count: 'exact' });

    // Now we need to join with users table to get email, role, organization_id, created_at
    // Actually, let's do two separate queries and merge them
    
    // First get users with filtering
    let usersQuery = (supabase as any)
      .from("users")
      .select("id, email, role, organization_id, created_at", { count: 'exact' });

    // Filter by organization for non-super_admin users
    if (profile.role !== "super_admin" && profile.organization_id) {
      usersQuery = usersQuery.eq("organization_id", profile.organization_id);
    }

    // Apply role filter
    if (role && role !== "all") {
      usersQuery = usersQuery.eq("role", role);
    }

    // Apply search filter on email
    if (search) {
      usersQuery = usersQuery.ilike("email", `%${search}%`);
    }

    // Apply pagination
    usersQuery = usersQuery.range(offset, offset + limit - 1).order("created_at", { ascending: false });

    const { data: usersData, error: usersError, count } = await usersQuery;

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    // Get profile data for these users
    const userIds = usersData?.map(u => u.id) || [];
    
    let profilesData: any[] = [];
    if (userIds.length > 0) {
      const { data: profiles } = await (supabase as any)
        .from("user_profiles")
        .select("id, name, avatar_url, organization_name, organization_slug")
        .in("id", userIds);
      
      profilesData = profiles || [];
    }

    // Merge users with their profiles
    const users = usersData?.map(user => ({
      ...user,
      user_profiles: profilesData.filter(p => p.id === user.id)
    })) || [];

    const error = null;

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
