import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generatePresignedUrl, deleteObject } from "@/lib/storage/s3";

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
 * GET /api/files/[id] - Generate a presigned download URL for a file.
 *
 * Clients can only download their own files. Staff/admins can download any
 * file in their organization. RLS on organization_files enforces org scope.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const authUser = await getAuthenticatedUser(supabase);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = supabase as unknown as { from: (table: string) => any };
    const { data: file, error } = await db
      .from("organization_files")
      .select("id, name, mime_type, s3_key, owner_user_id")
      .eq("id", id)
      .single();

    if (error || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Client isolation: non-privileged users can only access their own files
    if (!isPrivilegedRole(authUser.role) && file.owner_user_id !== authUser.id) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const url = await generatePresignedUrl(file.s3_key, 3600);

    return NextResponse.json({
      data: {
        id: file.id,
        name: file.name,
        mimeType: file.mime_type,
        downloadUrl: url,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/files/[id] - Delete a file from S3 and the database.
 *
 * Clients can only delete their own files. Staff/admins can delete any
 * file in their organization.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const authUser = await getAuthenticatedUser(supabase);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = supabase as unknown as { from: (table: string) => any };

    const { data: file, error } = await db
      .from("organization_files")
      .select("id, s3_key, owner_user_id")
      .eq("id", id)
      .single();

    if (error || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Client isolation: non-privileged users can only delete their own files
    if (!isPrivilegedRole(authUser.role) && file.owner_user_id !== authUser.id) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete from S3
    await deleteObject(file.s3_key);

    // Delete database record
    const { error: deleteError } = await db
      .from("organization_files")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
