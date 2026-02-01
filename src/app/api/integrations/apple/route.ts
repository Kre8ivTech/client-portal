import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

// Apple uses CalDAV which requires app-specific password, not OAuth
const connectSchema = z.object({
  email: z.string().email(),
  appPassword: z.string().min(1, "App-specific password is required"),
});

// POST: Connect Apple Calendar via CalDAV
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = connectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email, appPassword } = result.data;

    // CalDAV URL for Apple (iCloud)
    const caldavUrl = "https://caldav.icloud.com";

    // Verify credentials by attempting to access the CalDAV server
    const authHeader = Buffer.from(`${email}:${appPassword}`).toString("base64");
    const verifyResponse = await fetch(`${caldavUrl}/${email}/calendars/`, {
      method: "PROPFIND",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/xml",
        "Depth": "0",
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
  </d:prop>
</d:propfind>`,
    });

    if (!verifyResponse.ok && verifyResponse.status !== 207) {
      return NextResponse.json(
        { error: "Invalid credentials. Please check your email and app-specific password." },
        { status: 401 }
      );
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    // Store integration (table created in migration, cast to any for type safety)
    const { error: upsertError } = await (supabase as unknown as {
      from: (table: string) => {
        upsert: (data: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: Error | null }>;
      };
    }).from("oauth_integrations").upsert({
        user_id: user.id,
        organization_id: (userData as { organization_id: string } | null)?.organization_id,
        provider: "apple_caldav",
        caldav_url: caldavUrl,
        caldav_username: email,
        // Store app password as access_token for consistency
        access_token: appPassword,
        provider_email: email,
        scopes: ["calendars"],
        status: "active",
      }, {
        onConflict: "user_id,provider",
      });

    if (upsertError) {
      console.error("Failed to save Apple integration:", upsertError);
      return NextResponse.json(
        { error: "Failed to save integration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Apple CalDAV connection error:", err);
    return NextResponse.json(
      { error: "Failed to connect to Apple Calendar" },
      { status: 500 }
    );
  }
}

// DELETE: Disconnect integration
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("oauth_integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "apple_caldav");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
