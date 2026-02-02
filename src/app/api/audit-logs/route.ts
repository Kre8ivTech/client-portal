import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
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

    // Check if user is super_admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");
    const formatType = searchParams.get("format");

    // Build query
    let query = supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, user_id, details, created_at")
      .order("created_at", { ascending: false });

    // Apply date filters
    if (dateFrom) {
      query = query.gte("created_at", new Date(dateFrom).toISOString());
    }

    if (dateTo) {
      // Add 1 day to include the entire end date
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt("created_at", endDate.toISOString());
    }

    // If no date filters, default to last 30 days
    if (!dateFrom && !dateTo) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte("created_at", thirtyDaysAgo.toISOString());
    }

    // Limit to prevent excessive data
    query = query.limit(1000);

    const { data: logs, error } = await query;

    if (error) {
      console.error("Error fetching audit logs:", error);
      return NextResponse.json(
        { error: "Failed to fetch audit logs" },
        { status: 500 }
      );
    }

    // Return CSV format if requested
    if (formatType === "csv") {
      const csv = convertToCSV(logs || []);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit-logs-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv"`,
        },
      });
    }

    // Return JSON format
    return NextResponse.json({ logs: logs || [] });
  } catch (error) {
    console.error("Audit logs API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function convertToCSV(logs: any[]): string {
  if (logs.length === 0) {
    return "No audit logs found";
  }

  // Define CSV headers
  const headers = [
    "Timestamp",
    "Action",
    "Entity Type",
    "Entity ID",
    "User ID",
    "Details",
  ];

  // Create CSV rows
  const rows = logs.map((log) => {
    return [
      format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
      log.action || "",
      log.entity_type || "",
      log.entity_id || "",
      log.user_id || "",
      typeof log.details === "object" && log.details !== null
        ? JSON.stringify(log.details).replace(/"/g, '""')
        : "",
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  return csvContent;
}
