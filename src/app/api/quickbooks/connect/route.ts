import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireQuickBooksManager } from "@/lib/quickbooks/access";
import { getQuickBooksConfig, QuickBooksClient } from "@/lib/quickbooks/client";

/**
 * Initiate QuickBooks OAuth flow
 * GET /api/quickbooks/connect
 */
export async function GET() {
  try {
    const access = await requireQuickBooksManager();
    if (!access.ok) return access.response;

    const { supabase, actor } = access;
    const state = randomBytes(32).toString("hex");

    const { error: stateError } = await supabase.from("oauth_states").insert({
      state,
      provider: "quickbooks",
      user_id: actor.userId,
      organization_id: actor.organizationId,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (stateError) {
      console.error("Error storing QuickBooks OAuth state:", stateError);
      return NextResponse.json({ error: "Failed to initiate QuickBooks connection" }, { status: 500 });
    }

    const config = await getQuickBooksConfig(supabase, actor.organizationId);
    const authUrl = QuickBooksClient.getAuthorizationUrl(config, state);
    return NextResponse.json({ authorization_url: authUrl });
  } catch (error) {
    console.error("Error initiating QuickBooks OAuth:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to initiate QuickBooks connection",
      },
      { status: 500 },
    );
  }
}
