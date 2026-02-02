import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { createUserSchema, canCreateUsers, getAllowedRolesToCreate } from "@/lib/validators/user";
import { writeAuditLog } from "@/lib/audit";

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
      .select("id, email, role, organization_id, is_account_manager, status, created_at", { count: 'exact' });

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
    const userIds = usersData?.map((u: any) => u.id) || [];
    
    let profilesData: any[] = [];
    if (userIds.length > 0) {
      const { data: profiles } = await (supabase as any)
        .from("user_profiles")
        .select("id, name, avatar_url, organization_name, organization_slug")
        .in("id", userIds);
      
      profilesData = profiles || [];
    }

    // Merge users with their profiles
    const users = usersData?.map((user: any) => ({
      ...user,
      user_profiles: profilesData.filter((p: any) => p.id === user.id)
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

export async function POST(request: Request) {
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
      .select("id, email, role, organization_id, is_account_manager")
      .eq("id", user.id)
      .single();

    const profile = userData as { 
      id: string; 
      email: string; 
      role: string; 
      organization_id: string | null;
      is_account_manager: boolean;
    };

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Check if user can create users
    if (!canCreateUsers(profile.role as any, profile.is_account_manager)) {
      return NextResponse.json(
        { error: "Forbidden - You do not have permission to create users" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createUserSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Validation failed", 
          details: validationResult.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check if user is trying to create a role they're not allowed to
    const allowedRoles = getAllowedRolesToCreate(profile.role as any, profile.is_account_manager);
    if (!allowedRoles.includes(data.role as any)) {
      return NextResponse.json(
        { 
          error: `You are not allowed to create users with role: ${data.role}`,
          allowedRoles 
        },
        { status: 403 }
      );
    }

    // If creating a client, ensure organization_id is set
    if (data.role === "client" && !data.organization_id) {
      // For non-super_admin, use their own organization
      if (profile.role !== "super_admin") {
        data.organization_id = profile.organization_id;
      } else {
        return NextResponse.json(
          { error: "organization_id is required when creating a client" },
          { status: 400 }
        );
      }
    }

    // For staff roles, if super_admin doesn't specify org, it's null (Kre8ivTech staff)
    // For staff roles, if staff creates (which they can't per our rules, but just in case), use their org

    // Check if email already exists
    const { data: existingUser } = await (supabase as any)
      .from("users")
      .select("id, email")
      .eq("email", data.email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    // Use admin client to create user in Supabase Auth
    const supabaseAdmin = getSupabaseAdmin();
    
    // Generate a temporary password (user will need to reset it)
    const temporaryPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
    
    const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: temporaryPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: data.name,
      }
    });

    if (createAuthError || !newAuthUser.user) {
      console.error("Error creating auth user:", createAuthError);
      return NextResponse.json(
        { error: createAuthError?.message || "Failed to create user" },
        { status: 500 }
      );
    }

    // Create user record in public.users table
    const { error: createUserError } = await (supabaseAdmin as any)
      .from("users")
      .insert({
        id: newAuthUser.user.id,
        email: data.email,
        role: data.role,
        organization_id: data.organization_id,
        is_account_manager: data.is_account_manager,
        status: "active",
      });

    if (createUserError) {
      console.error("Error creating user record:", createUserError);
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id);
      return NextResponse.json(
        { error: "Failed to create user record" },
        { status: 500 }
      );
    }

    // Create profile record
    const { error: createProfileError } = await (supabaseAdmin as any)
      .from("profiles")
      .insert({
        user_id: newAuthUser.user.id,
        name: data.name,
      });

    if (createProfileError) {
      console.error("Error creating profile:", createProfileError);
      // Note: The auth trigger should handle profile creation, but we're doing it explicitly
      // If this fails, it's not critical as the trigger will create it
    }

    // Send password reset email if requested
    if (data.send_invite_email) {
      const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: data.email,
      });

      if (resetError) {
        console.error("Error sending invite email:", resetError);
        // Don't fail the request if email sending fails
      }
    }

    // Write audit log
    await writeAuditLog({
      action: "user.create",
      entity_type: "user",
      entity_id: newAuthUser.user.id,
      details: {
        email: data.email,
        name: data.name,
        role: data.role,
        organization_id: data.organization_id,
        is_account_manager: data.is_account_manager,
        created_by: user.id,
        created_by_email: profile.email,
      },
    });

    return NextResponse.json({
      message: "User created successfully",
      user: {
        id: newAuthUser.user.id,
        email: data.email,
        name: data.name,
        role: data.role,
        organization_id: data.organization_id,
      },
    }, { status: 201 });

  } catch (error) {
    console.error("Error in create user API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
