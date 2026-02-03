import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyApiKey, hasScope } from "@/lib/zapier/auth";
import { z } from "zod";

const createWebhookSchema = z.object({
  url: z.string().url(),
  event_type: z.enum([
    "ticket.created",
    "ticket.updated",
    "ticket.closed",
    "invoice.created",
    "invoice.paid",
    "invoice.overdue",
    "contract.created",
    "contract.signed",
    "contract.completed",
    "message.received",
    "form.submitted",
  ]),
  filters: z.record(z.any()).optional(),
});

// GET: List all webhooks (supports both user auth and API key auth)
export async function GET(request: NextRequest) {
  try {
    // Try API key auth first
    const apiKeyContext = await verifyApiKey(request);
    
    let userId: string;
    let supabase;

    if (apiKeyContext) {
      userId = apiKeyContext.userId;
      supabase = await createServerSupabaseClient();
    } else {
      // Fall back to user session auth
      supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = user.id;
    }

    const { data: webhooks, error } = await supabase
      .from("zapier_webhooks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: webhooks });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create a new webhook subscription (supports both auth methods)
export async function POST(request: NextRequest) {
  try {
    // Try API key auth first
    const apiKeyContext = await verifyApiKey(request);
    
    let userId: string;
    let organizationId: string;
    let supabase;

    if (apiKeyContext) {
      if (!hasScope(apiKeyContext, "write:webhooks")) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        );
      }
      userId = apiKeyContext.userId;
      organizationId = apiKeyContext.organizationId;
      supabase = await createServerSupabaseClient();
    } else {
      // Fall back to user session auth
      supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Get user's organization
      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!userData?.organization_id) {
        return NextResponse.json(
          { error: "User organization not found" },
          { status: 400 }
        );
      }

      userId = user.id;
      organizationId = userData.organization_id;
    }

    const body = await request.json();
    const result = createWebhookSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    // Insert webhook
    const { data: webhook, error } = await supabase
      .from("zapier_webhooks")
      .insert({
        user_id: userId,
        organization_id: organizationId,
        url: result.data.url,
        event_type: result.data.event_type,
        filters: result.data.filters || {},
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: webhook }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
