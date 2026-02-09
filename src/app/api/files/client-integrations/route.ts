import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type UserRow = {
  organization_id: string | null;
  role: string;
};

/**
 * GET /api/files/client-integrations
 *
 * Returns a list of client organizations (within the user's org scope)
 * along with their cloud drive integration status.
 *
 * Only accessible by super_admin and staff roles.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    const profile = userRow as UserRow | null;
    if (!profile?.organization_id) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const isPrivileged =
      profile.role === "super_admin" || profile.role === "staff";
    if (!isPrivileged) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = supabase as unknown as { from: (table: string) => any };

    // Get all client and partner organizations
    const { data: organizations } = await db
      .from("organizations")
      .select("id, name, slug, type, status")
      .in("type", ["client", "partner"])
      .eq("status", "active")
      .order("name", { ascending: true });

    const orgs = (organizations ?? []) as Array<{
      id: string;
      name: string;
      slug: string;
      type: string;
      status: string;
    }>;

    if (orgs.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const orgIds = orgs.map((o) => o.id);

    // Get users in these organizations
    const { data: orgUsers } = await db
      .from("users")
      .select("id, organization_id")
      .in("organization_id", orgIds);

    const usersByOrg: Record<string, string[]> = {};
    for (const u of (orgUsers ?? []) as Array<{
      id: string;
      organization_id: string;
    }>) {
      if (!usersByOrg[u.organization_id]) {
        usersByOrg[u.organization_id] = [];
      }
      usersByOrg[u.organization_id].push(u.id);
    }

    const allUserIds = Object.values(usersByOrg).flat();

    // Get cloud drive integrations for all those users
    const providerList = ["google_drive", "microsoft_onedrive", "dropbox"];
    let integrations: Array<{
      id: string;
      user_id: string;
      provider: string;
      provider_email: string | null;
      status: string;
      last_sync_at: string | null;
    }> = [];

    if (allUserIds.length > 0) {
      const { data: intData } = await supabase
        .from("oauth_integrations")
        .select("id, user_id, provider, provider_email, status, last_sync_at")
        .in("user_id", allUserIds)
        .in("provider", providerList);

      integrations = (intData ?? []) as typeof integrations;
    }

    // Build integration lookup by org
    const integrationsByOrg: Record<
      string,
      Array<{
        id: string;
        provider: string;
        provider_email: string | null;
        status: string;
        last_sync_at: string | null;
        user_id: string;
      }>
    > = {};

    for (const integration of integrations) {
      // Find which org this user belongs to
      const orgId = Object.keys(usersByOrg).find((orgId) =>
        usersByOrg[orgId].includes(integration.user_id)
      );
      if (orgId) {
        if (!integrationsByOrg[orgId]) {
          integrationsByOrg[orgId] = [];
        }
        integrationsByOrg[orgId].push({
          id: integration.id,
          provider: integration.provider,
          provider_email: integration.provider_email,
          status: integration.status,
          last_sync_at: integration.last_sync_at,
          user_id: integration.user_id,
        });
      }
    }

    // Compose the response
    const result = orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.type,
      userCount: usersByOrg[org.id]?.length ?? 0,
      integrations: integrationsByOrg[org.id] ?? [],
      hasGoogleDrive: (integrationsByOrg[org.id] ?? []).some(
        (i) => i.provider === "google_drive" && i.status === "active"
      ),
      hasOneDrive: (integrationsByOrg[org.id] ?? []).some(
        (i) => i.provider === "microsoft_onedrive" && i.status === "active"
      ),
      hasDropbox: (integrationsByOrg[org.id] ?? []).some(
        (i) => i.provider === "dropbox" && i.status === "active"
      ),
    }));

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("Error fetching client integrations:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
