import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, decryptLegacy } from "@/lib/crypto";

const APP_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export type S3ConfigFromAppSettings = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  kmsKeyId: string | undefined;
};

type StoredPayload = {
  aws_region: string;
  access_key_id: string;
  secret_access_key: string;
  bucket_name: string;
  kms_key_id?: string | null;
};

/**
 * Resolve S3 config from encrypted app_settings. Returns null if not set or decryption fails.
 * Use server-side only (API routes, server components).
 */
export async function getS3ConfigFromAppSettings(): Promise<S3ConfigFromAppSettings | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any)
    .from("app_settings")
    .select(
      "aws_s3_config_encrypted, aws_s3_config_iv, aws_s3_config_auth_tag, aws_s3_config_salt"
    )
    .eq("id", APP_SETTINGS_ID)
    .single();

  if (error || !data?.aws_s3_config_encrypted) {
    return null;
  }

  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 8) {
    return null;
  }

  try {
    const decrypted =
      typeof data.aws_s3_config_salt === "string" && data.aws_s3_config_salt.length > 0
        ? decrypt(
            data.aws_s3_config_encrypted,
            data.aws_s3_config_iv,
            data.aws_s3_config_auth_tag,
            data.aws_s3_config_salt
          )
        : decryptLegacy(
            data.aws_s3_config_encrypted,
            data.aws_s3_config_iv,
            data.aws_s3_config_auth_tag
          );
    const parsed = JSON.parse(decrypted) as StoredPayload;
    if (
      typeof parsed.access_key_id === "string" &&
      typeof parsed.secret_access_key === "string" &&
      typeof parsed.bucket_name === "string"
    ) {
      return {
        region: parsed.aws_region || "us-east-1",
        accessKeyId: parsed.access_key_id,
        secretAccessKey: parsed.secret_access_key,
        bucketName: parsed.bucket_name,
        kmsKeyId: parsed.kms_key_id && String(parsed.kms_key_id).trim() ? String(parsed.kms_key_id).trim() : undefined,
      };
    }
  } catch {
    // Decryption or parse failed
  }
  return null;
}
