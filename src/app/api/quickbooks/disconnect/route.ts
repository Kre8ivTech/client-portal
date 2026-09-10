import { NextResponse } from "next/server";
import { requireQuickBooksManager } from "@/lib/quickbooks/access";
import { getQuickBooksConfig } from "@/lib/quickbooks/client";
import { decryptQuickBooksTokens } from "@/lib/quickbooks/tokens";
import { QUICKBOOKS_TOKEN_SELECT } from "@/lib/quickbooks/connection";

async function revokeQuickBooksToken(refreshToken: string, clientId: string, clientSecret: string) {
  const response = await fetch("https://developer.api.intuit.com/v2/oauth2/tokens/revoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ token: refreshToken }),
  });
  if (!response.ok) {
    console.error("QuickBooks token revoke failed:", await response.text());
  }
}

/**
 * Disconnect QuickBooks integration
 * DELETE /api/quickbooks/disconnect
 */
export async function DELETE() {
  try {
    const access = await requireQuickBooksManager();
    if (!access.ok) return access.response;
    const { supabase, actor } = access;

    const { data: integration } = await supabase
      .from("quickbooks_integrations")
      .select(QUICKBOOKS_TOKEN_SELECT)
      .eq("organization_id", actor.organizationId)
      .maybeSingle();

    if (integration) {
      try {
        const tokens = decryptQuickBooksTokens(integration as never);
        const config = await getQuickBooksConfig(supabase, actor.organizationId);
        await revokeQuickBooksToken(tokens.refreshToken, config.clientId, config.clientSecret);
      } catch (error) {
        console.error("Failed to revoke QuickBooks token:", error);
      }
    }

    const { error: deleteError } = await supabase
      .from("quickbooks_integrations")
      .delete()
      .eq("organization_id", actor.organizationId);

    if (deleteError) {
      console.error("Error disconnecting QuickBooks:", deleteError);
      return NextResponse.json({ error: "Failed to disconnect QuickBooks" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "QuickBooks disconnected successfully",
    });
  } catch (error) {
    console.error("Error disconnecting QuickBooks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
