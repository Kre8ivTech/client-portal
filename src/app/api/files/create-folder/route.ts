import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { uploadObject, sanitizeS3KeyPart } from "@/lib/storage/s3";
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const authUser = await getAuthenticatedUser(supabase);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get request body
    const { folderPath } = await request.json();

    if (!folderPath || typeof folderPath !== "string") {
      return NextResponse.json(
        { error: "Folder path is required" },
        { status: 400 }
      );
    }

    // Validate folder path
    if (!/^[a-zA-Z0-9-_ /]+$/.test(folderPath)) {
      return NextResponse.json(
        { error: "Invalid folder path. Use only letters, numbers, spaces, hyphens, underscores, and slashes" },
        { status: 400 }
      );
    }

    // Get org storage settings for custom prefix
    const db = supabase as unknown as { from: (table: string) => any };
    const { data: settings } = await db
      .from("organization_file_storage_settings")
      .select("s3_prefix, enabled")
      .eq("organization_id", authUser.organizationId)
      .maybeSingle();

    if (settings && !settings.enabled) {
      return NextResponse.json(
        { error: "File storage is disabled for this organization" },
        { status: 403 }
      );
    }

    // Build the S3 key based on org settings and user role
    const orgPrefix =
      normalizeS3Prefix(settings?.s3_prefix) ||
      `org/${authUser.organizationId}`;

    // Sanitize the folder path
    const safeFolderPath = sanitizeS3KeyPart(folderPath);

    let s3Key: string;

    if (isPrivilegedRole(authUser.role)) {
      // Staff/admin: create folder in org directory
      s3Key = `${orgPrefix}/${safeFolderPath}/`;
    } else {
      // Client: create folder in their user directory
      s3Key = `${orgPrefix}/clients/${authUser.id}/${safeFolderPath}/`;
    }

    // Create the folder by uploading an empty object with a trailing slash
    // S3 uses trailing slash to indicate a folder/prefix
    await uploadObject({
      key: s3Key,
      body: Buffer.from(""),
      contentType: "application/x-directory",
      metadata: {
        organizationId: authUser.organizationId,
        createdBy: authUser.id,
        folderName: safeFolderPath,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Folder created successfully",
        data: {
          folderPath,
          s3Key,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
