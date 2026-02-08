import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resetS3Config } from "@/lib/storage/s3";
import { z } from "zod";

const configSchema = z.object({
  aws_region: z.string().min(1).max(30).default("us-east-1"),
  access_key_id: z.string().min(1, "Access Key ID is required"),
  secret_access_key: z.string().min(1).optional(), // optional on updates
  bucket_name: z.string().min(1, "Bucket name is required"),
  kms_key_id: z.string().max(256).nullable().optional(),
});

async function requireSuperAdmin(supabase: any) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (userRow as { role?: string } | null)?.role;
  if (role !== "super_admin") return null;

  return user;
}

/**
 * GET /api/admin/s3/config - Get current S3 configuration (secrets masked)
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const user = await requireSuperAdmin(supabase);

    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = supabase as unknown as { from: (table: string) => any };
    const { data: config } = await db
      .from("aws_s3_config")
      .select(
        "id, aws_region, access_key_id, bucket_name, kms_key_id, created_at, updated_at"
      )
      .is("organization_id", null)
      .maybeSingle();

    // Also report whether env vars are set (as a fallback indicator)
    const envConfigured =
      !!process.env.AWS_S3_BUCKET_NAME &&
      !!process.env.AWS_ACCESS_KEY_ID &&
      !!process.env.AWS_SECRET_ACCESS_KEY;

    return NextResponse.json({
      config: config
        ? {
            ...config,
            // Mask the access key for display
            access_key_id_masked: maskKey(config.access_key_id),
          }
        : null,
      envConfigured,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/s3/config - Save or update S3 configuration
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const user = await requireSuperAdmin(supabase);

    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const validation = configSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const db = supabase as unknown as { from: (table: string) => any };

    // Check for existing global config
    const { data: existing } = await db
      .from("aws_s3_config")
      .select("id")
      .is("organization_id", null)
      .maybeSingle();

    if (existing) {
      // Update
      const updateData: Record<string, unknown> = {
        aws_region: validation.data.aws_region,
        access_key_id: validation.data.access_key_id,
        bucket_name: validation.data.bucket_name,
        updated_by: user.id,
      };

      if (validation.data.secret_access_key) {
        updateData.secret_access_key = validation.data.secret_access_key;
      }

      if (validation.data.kms_key_id !== undefined) {
        updateData.kms_key_id = validation.data.kms_key_id || null;
      }

      const { error } = await db
        .from("aws_s3_config")
        .update(updateData)
        .eq("id", existing.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // Insert new
      if (!validation.data.secret_access_key) {
        return NextResponse.json(
          { error: "Secret Access Key is required for initial setup" },
          { status: 400 }
        );
      }

      const { error } = await db.from("aws_s3_config").insert({
        aws_region: validation.data.aws_region,
        access_key_id: validation.data.access_key_id,
        secret_access_key: validation.data.secret_access_key,
        bucket_name: validation.data.bucket_name,
        kms_key_id: validation.data.kms_key_id || null,
        organization_id: null,
        created_by: user.id,
        updated_by: user.id,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Clear cached S3 config so next request picks up the new credentials
    resetS3Config();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/s3/config - Remove S3 configuration (falls back to env vars)
 */
export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient();
    const user = await requireSuperAdmin(supabase);

    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = supabase as unknown as { from: (table: string) => any };
    const { error } = await db
      .from("aws_s3_config")
      .delete()
      .is("organization_id", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Clear cached S3 config so next request falls back to env vars
    resetS3Config();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}
