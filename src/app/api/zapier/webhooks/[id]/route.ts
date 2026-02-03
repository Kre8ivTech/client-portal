import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyApiKey } from "@/lib/zapier/auth";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// DELETE: Remove a webhook subscription
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
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

    const { error } = await supabase
      .from("zapier_webhooks")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Update webhook (toggle active status or update URL)
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
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

    const body = await request.json();
    const { is_active, url } = body;

    const updateData: any = {};
    if (typeof is_active === "boolean") {
      updateData.is_active = is_active;
    }
    if (url) {
      updateData.url = url;
    }

    const { data, error } = await supabase
      .from("zapier_webhooks")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
