import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resetS3Config } from "@/lib/storage/s3";
import { encrypt } from "@/lib/crypto";
import { z } from "zod";

const APP_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

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
 * Prefers encrypted app_settings; falls back to aws_s3_config (legacy).
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const user = await requireSuperAdmin(supabase);

    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const { data: appRow } = await (admin as any)
      .from("app_settings")
      .select("aws_s3_config_encrypted")
      .eq("id", APP_SETTINGS_ID)
      .single();

    if (appRow?.aws_s3_config_encrypted) {
      const envConfigured =
        !!process.env.AWS_S3_BUCKET_NAME &&
        !!process.env.AWS_ACCESS_KEY_ID &&
        !!process.env.AWS_SECRET_ACCESS_KEY;
      return NextResponse.json({
        config: {
          id: "encrypted",
          aws_region: "us-east-1",
          access_key_id_masked: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
          bucket_name: "(encrypted)",
          kms_key_id: null,
          created_at: "",
          updated_at: "",
        },
        source: "encrypted",
        envConfigured,
      });
    }

    const db = supabase as unknown as { from: (table: string) => any };
    const { data: config } = await db
      .from("aws_s3_config")
      .select(
        "id, aws_region, access_key_id, bucket_name, kms_key_id, created_at, updated_at"
      )
      .is("organization_id", null)
      .maybeSingle();

    const envConfigured =
      !!process.env.AWS_S3_BUCKET_NAME &&
      !!process.env.AWS_ACCESS_KEY_ID &&
      !!process.env.AWS_SECRET_ACCESS_KEY;

    return NextResponse.json({
      config: config
        ? {
            ...config,
            access_key_id_masked: maskKey(config.access_key_id),
          }
        : null,
      source: config ? "legacy" : "none",
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
 * POST /api/admin/s3/config - Save S3 configuration (encrypted in app_settings)
 * Requires ENCRYPTION_SECRET. Removes legacy plain config from aws_s3_config.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const user = await requireSuperAdmin(supabase);

    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret || secret.length < 8) {
      return NextResponse.json(
        {
          error:
            "ENCRYPTION_SECRET must be set in the environment (at least 8 characters) to store S3 credentials encrypted.",
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const validation = configSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const secretAccessKey = validation.data.secret_access_key;
    if (!secretAccessKey || secretAccessKey === "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022") {
      return NextResponse.json(
        { error: "Secret Access Key is required" },
        { status: 400 }
      );
    }

    const payload = {
      aws_region: validation.data.aws_region,
      access_key_id: validation.data.access_key_id,
      secret_access_key: secretAccessKey,
      bucket_name: validation.data.bucket_name,
      kms_key_id: validation.data.kms_key_id ?? null,
    };
    const { encryptedData, iv, authTag } = encrypt(JSON.stringify(payload));

    const admin = getSupabaseAdmin();
    const { error: updateError } = await (admin as any)
      .from("app_settings")
      .update({
        aws_s3_config_encrypted: encryptedData,
        aws_s3_config_iv: iv,
        aws_s3_config_auth_tag: authTag,
      })
      .eq("id", APP_SETTINGS_ID);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const db = supabase as unknown as { from: (table: string) => any };
    await db.from("aws_s3_config").delete().is("organization_id", null);

    resetS3Config();
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/s3/config - Remove S3 configuration (encrypted + legacy), fall back to env
 */
export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient();
    const user = await requireSuperAdmin(supabase);

    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    await (admin as any)
      .from("app_settings")
      .update({
        aws_s3_config_encrypted: null,
        aws_s3_config_iv: null,
        aws_s3_config_auth_tag: null,
      })
      .eq("id", APP_SETTINGS_ID);

    const db = supabase as unknown as { from: (table: string) => any };
    await db.from("aws_s3_config").delete().is("organization_id", null);

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
