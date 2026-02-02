import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey, hasScope } from "@/lib/zapier/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET: List contracts (for Zapier polling triggers)
export async function GET(request: NextRequest) {
  try {
    const apiKeyContext = await verifyApiKey(request);

    if (!apiKeyContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasScope(apiKeyContext, "read:contracts")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 100);
    const since = searchParams.get("since"); // ISO timestamp for polling
    const status = searchParams.get("status"); // Filter by status

    let query = supabaseAdmin
      .from("contracts")
      .select("*")
      .eq("organization_id", apiKeyContext.organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gt("created_at", since);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: contracts, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: contracts });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
