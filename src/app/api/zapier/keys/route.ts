import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateApiKey, hashApiKey } from "@/lib/zapier/auth";
import { z } from "zod";

const createKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).optional(),
  expires_at: z.string().optional(),
});

// GET: List all API keys for the user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: keys, error } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: keys });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create a new API key
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
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

    const body = await request.json();
    const result = createKeySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    // Generate API key
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 15); // e.g., "kt_live_abcdefg"

    // Default scopes if not provided
    const scopes = result.data.scopes || [
      "read:tickets",
      "write:tickets",
      "read:invoices",
      "read:contracts",
      "read:messages",
    ];

    // Insert into database
    const { data: keyData, error } = await supabase
      .from("api_keys")
      .insert({
        user_id: user.id,
        organization_id: userData.organization_id,
        name: result.data.name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        scopes,
        expires_at: result.data.expires_at || null,
      })
      .select("id, name, key_prefix, scopes, is_active, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return the key only once (it won't be shown again)
    return NextResponse.json(
      {
        data: keyData,
        api_key: apiKey,
        message: "Save this API key securely. It won't be shown again.",
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
