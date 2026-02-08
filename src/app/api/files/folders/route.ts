import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listFolders } from "@/lib/storage/s3";
import { normalizeS3Prefix } from "@/lib/file-sync/s3-prefix";

type UserRow = {
  organization_id: string | null;
  role: string;
};

async function getAuthenticatedUser(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userRow } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  const row = userRow as UserRow | null;
  if (!row?.organization_id) return null;

  return {
    id: user.id,
    organizationId: row.organization_id,
    role: row.role ?? "client",
  };
}

function isPrivilegedRole(role: string): boolean {
  return role === "super_admin" || role === "staff";
}

/**
 * GET /api/files/folders - Browse S3 folder structure for the org.
 *
 * Query params:
 *   - prefix: S3 prefix to list (relative to org root). Defaults to org root.
 *   - continuationToken: For pagination
 *
 * Staff/admin see the full org folder tree.
 * Clients only see their own client folder.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const authUser = await getAuthenticatedUser(supabase);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const requestedPrefix = searchParams.get("prefix") || "";
    const continuationToken = searchParams.get("continuationToken") || undefined;

    // Get org storage settings for custom prefix
    const db = supabase as unknown as { from: (table: string) => any };
    const { data: settings } = await db
      .from("organization_file_storage_settings")
      .select("s3_prefix, enabled")
      .eq("organization_id", authUser.organizationId)
      .maybeSingle();

    const orgPrefix =
      normalizeS3Prefix(settings?.s3_prefix) ||
      `org/${authUser.organizationId}`;

    // Build the full S3 prefix to list
    let fullPrefix: string;

    if (requestedPrefix) {
      // Ensure requested prefix stays within org scope
      const cleanPrefix = requestedPrefix.replace(/^\/+/, "").replace(/\/+$/, "");
      fullPrefix = `${orgPrefix}/${cleanPrefix}`;
    } else {
      fullPrefix = orgPrefix;
    }

    // Client isolation: non-privileged users can only browse their own folder
    if (!isPrivilegedRole(authUser.role)) {
      const clientPrefix = `${orgPrefix}/clients/${authUser.id}`;
      if (!fullPrefix.startsWith(clientPrefix)) {
        fullPrefix = clientPrefix;
      }
    }

    // Ensure we don't escape org scope
    if (!fullPrefix.startsWith(orgPrefix)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const result = await listFolders({
      prefix: fullPrefix,
      maxKeys: 200,
      continuationToken,
    });

    // Strip org prefix from folder paths for display
    const relativeFolders = result.folders.map((f) => ({
      name: f.name,
      prefix: f.prefix,
      relativePath: f.prefix.replace(`${orgPrefix}/`, ""),
    }));

    const relativeObjects = result.objects.map((o) => ({
      ...o,
      relativePath: o.key.replace(`${orgPrefix}/`, ""),
    }));

    return NextResponse.json({
      data: {
        folders: relativeFolders,
        files: relativeObjects,
        currentPrefix: fullPrefix.replace(`${orgPrefix}/`, "") || "/",
        orgPrefix,
        hasMore: result.isTruncated,
        nextToken: result.nextToken,
      },
    });
  } catch (err) {
    console.error("Error listing folders:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
