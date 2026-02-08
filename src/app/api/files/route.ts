import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  uploadObject,
  BUCKET_NAME,
  sanitizeS3KeyPart,
} from "@/lib/storage/s3";
import { normalizeS3Prefix } from "@/lib/file-sync/s3-prefix";
import { fileUploadSchema, fileListQuerySchema } from "@/lib/validators/file";

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
 * GET /api/files - List files for the user's organization.
 *
 * Client-scoped isolation:
 *   - Clients only see files they uploaded (owner_user_id = their id).
 *   - Staff and super_admin see all files in the organization.
 *
 * RLS on organization_files already enforces org-level access. This route
 * adds a further owner filter for non-privileged roles so that client A
 * cannot see client B's files.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const authUser = await getAuthenticatedUser(supabase);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const parsed = fileListQuerySchema.safeParse({
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { cursor, limit, search } = parsed.data;

    const db = supabase as unknown as { from: (table: string) => any };
    let query = db
      .from("organization_files")
      .select(
        "id, name, mime_type, size_bytes, source_provider, s3_key, created_at, owner_user_id, folder"
      )
      .eq("organization_id", authUser.organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Client isolation: non-privileged users only see their own files
    if (!isPrivilegedRole(authUser.role)) {
      query = query.eq("owner_user_id", authUser.id);
    }

    if (cursor) {
      const { data: cursorRow } = await db
        .from("organization_files")
        .select("created_at")
        .eq("id", cursor)
        .single();

      if (cursorRow) {
        query = query.lt("created_at", cursorRow.created_at);
      }
    }

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data: files, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: files ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/files - Upload a file to S3 and record it in the database.
 *
 * Files are stored in an encrypted, per-client folder:
 *   {org_prefix}/clients/{user_id}/{timestamp}-{filename}
 *
 * Accepts multipart/form-data with a single "file" field and an optional
 * "folder" text field for logical folder grouping.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const authUser = await getAuthenticatedUser(supabase);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const folder = (formData.get("folder") as string | null)?.trim() || null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "No file provided. Send a `file` field in multipart/form-data.",
        },
        { status: 400 }
      );
    }

    const validation = fileUploadSchema.safeParse({
      name: file.name,
      contentType: file.type,
      size: file.size,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Check org storage settings
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

    // Build per-client S3 key with org isolation
    const orgPrefix =
      normalizeS3Prefix(settings?.s3_prefix) ||
      `org/${authUser.organizationId}`;
    const safeName = sanitizeS3KeyPart(file.name);
    const timestamp = Date.now();

    // Per-client folder: org/{org_id}/clients/{user_id}/[folder/]{timestamp}-{file}
    const folderSegment = folder
      ? `${sanitizeS3KeyPart(folder)}/`
      : "";
    const s3Key = `${orgPrefix}/clients/${authUser.id}/${folderSegment}${timestamp}-${safeName}`;

    // Upload to S3 (encryption is applied automatically via SSE in uploadObject)
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadObject({
      key: s3Key,
      body: buffer,
      contentType: file.type,
      metadata: {
        organizationId: authUser.organizationId,
        uploadedBy: authUser.id,
        originalName: file.name,
      },
    });

    // Record in database
    const fileId = crypto.randomUUID();
    const { data: record, error: insertError } = await db
      .from("organization_files")
      .insert({
        id: fileId,
        organization_id: authUser.organizationId,
        owner_user_id: authUser.id,
        source_provider: "direct_upload",
        source_file_id: fileId,
        name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        s3_bucket: BUCKET_NAME,
        s3_key: s3Key,
        folder: folder,
        synced_at: new Date().toISOString(),
      })
      .select(
        "id, name, mime_type, size_bytes, s3_key, folder, created_at"
      )
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: record }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
