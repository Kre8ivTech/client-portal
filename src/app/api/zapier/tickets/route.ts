import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey, hasScope } from "@/lib/zapier/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET: List tickets (for Zapier polling triggers)
export async function GET(request: NextRequest) {
  try {
    const apiKeyContext = await verifyApiKey(request);

    if (!apiKeyContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasScope(apiKeyContext, "read:tickets")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 100);
    const since = searchParams.get("since"); // ISO timestamp for polling

    let query = supabaseAdmin
      .from("tickets")
      .select("*, created_by_user:users!tickets_created_by_fkey(id, email, profiles:profiles(name))")
      .eq("organization_id", apiKeyContext.organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gt("created_at", since);
    }

    const { data: tickets, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: tickets });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create a new ticket (for Zapier actions)
export async function POST(request: NextRequest) {
  try {
    const apiKeyContext = await verifyApiKey(request);

    if (!apiKeyContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasScope(apiKeyContext, "write:tickets")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { subject, description, priority, category } = body;

    if (!subject || !description) {
      return NextResponse.json(
        { error: "subject and description are required" },
        { status: 400 }
      );
    }

    // Get the next ticket number
    const { data: lastTicket } = await supabaseAdmin
      .from("tickets")
      .select("ticket_number")
      .eq("organization_id", apiKeyContext.organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
    if (lastTicket?.ticket_number) {
      const match = lastTicket.ticket_number.match(/T-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const ticketNumber = `T-${nextNumber.toString().padStart(4, "0")}`;

    const { data: ticket, error } = await supabaseAdmin
      .from("tickets")
      .insert({
        organization_id: apiKeyContext.organizationId,
        created_by: apiKeyContext.userId,
        ticket_number: ticketNumber,
        subject,
        description,
        priority: priority || "medium",
        category: category || null,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: ticket }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
