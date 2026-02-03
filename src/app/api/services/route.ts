import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/services - List available services for clients
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's profile
    const { data: profile } = await supabase.from("users").select("organization_id, role").eq("id", user.id).single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    // Build query - RLS will filter to only show accessible services
    // (active services in user's org + global services)
    let query = supabase
      .from("services")
      .select(
        "id, name, description, category, base_rate, rate_type, estimated_hours, is_active, is_global, display_order",
      )
      .eq("is_active", true) // Only show active services to clients
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    // Apply category filter if provided
    if (category) {
      query = query.eq("category", category);
    }

    const { data: services, error } = await query;

    if (error) {
      console.error("Error fetching services:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: services }, { status: 200 });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
