import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function isMissingColumnError(error: any, column: string) {
  if (!error) return false;
  
  // Check for error message first - it should contain the column name
  const message = error.message;
  if (!message) return false;
  const m = message.toLowerCase();
  const col = column.toLowerCase();
  
  // Check for PostgreSQL error code 42703 (undefined_column) with column name in message
  if (error.code === '42703' && m.includes(col)) return true;
  
  // Check for error message patterns
  return (
    (m.includes("schema cache") && (m.includes(`'${col}'`) || m.includes(`"${col}"`))) ||
    (m.includes("does not exist") && m.includes(col))
  );
}

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
    const baseSelect =
      "id, name, description, category, base_rate, rate_type, estimated_hours, is_active, display_order";
    const selectWithGlobal = `${baseSelect}, is_global`;

    let query = supabase
      .from("services")
      .select(selectWithGlobal)
      .eq("is_active", true) // Only show active services to clients
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    // Apply category filter if provided
    if (category) {
      query = query.eq("category", category);
    }

    let { data: services, error } = await query;
    let responseServices: any[] | null = services as any;

    // Backwards-compat: retry without is_global if DB hasn't been migrated yet.
    if (error && isMissingColumnError(error, "is_global")) {
      let retryQuery = supabase
        .from("services")
        .select(baseSelect)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (category) {
        retryQuery = retryQuery.eq("category", category);
      }
      ({ data: services, error } = await retryQuery);
      // Normalize response shape for callers expecting is_global
      responseServices = (services || []).map((s: any) => ({ ...s, is_global: false }));
    } else {
      responseServices = services as any;
    }

    if (error) {
      console.error("Error fetching services:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: responseServices }, { status: 200 });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
