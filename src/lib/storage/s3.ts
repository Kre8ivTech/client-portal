import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  HeadObjectCommand,
  type ServerSideEncryption,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ---------------------------------------------------------------------------
// S3 Configuration
//
// Credentials are resolved in this order:
//   1. app_settings (encrypted: aws_s3_config_encrypted + iv + auth_tag)
//   2. Database table `aws_s3_config` (global row where organization_id IS NULL)
//   3. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, etc.)
//
// The resolved config is cached for the lifetime of the serverless invocation
// (typically a single request). Call `resetS3Config()` to force a re-read.
// ---------------------------------------------------------------------------

import { getS3ConfigFromAppSettings } from "@/lib/s3-config";

type S3Config = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  kmsKeyId: string | undefined;
};

export type S3ConnectionStatus = {
  configured: boolean;
  connected: boolean;
  message: string | null;
};

let _cachedConfig: S3Config | null = null;
let _cachedClient: S3Client | null = null;

function envConfig(): S3Config | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucketName = process.env.AWS_S3_BUCKET_NAME;

  if (!accessKeyId || !secretAccessKey || !bucketName) return null;

  return {
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId,
    secretAccessKey,
    bucketName,
    kmsKeyId: process.env.AWS_S3_KMS_KEY_ID || undefined,
  };
}

async function dbConfig(): Promise<S3Config | null> {
  try {
    // Dynamic import to avoid circular dependency / module-load issues.
    // supabaseAdmin bypasses RLS, which is necessary because this function
    // runs outside of a user request context (no auth session).
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const { data } = await (supabaseAdmin as any)
      .from("aws_s3_config")
      .select(
        "aws_region, access_key_id, secret_access_key, bucket_name, kms_key_id"
      )
      .is("organization_id", null)
      .maybeSingle();

    if (!data) return null;

    return {
      region: data.aws_region || "us-east-1",
      accessKeyId: data.access_key_id,
      secretAccessKey: data.secret_access_key,
      bucketName: data.bucket_name,
      kmsKeyId: data.kms_key_id || undefined,
    };
  } catch {
    // Table may not exist yet (pre-migration) or admin client unavailable
    return null;
  }
}

async function resolveConfig(): Promise<S3Config> {
  if (_cachedConfig) return _cachedConfig;

  // 1. Encrypted app_settings, 2. aws_s3_config table, 3. env vars
  const fromApp = await getS3ConfigFromAppSettings();
  if (fromApp) {
    _cachedConfig = fromApp;
    return fromApp;
  }
  const fromDb = await dbConfig();
  const fromEnv = envConfig();
  const config = fromDb || fromEnv;

  if (!config) {
    throw new Error(
      "AWS S3 is not configured. Set credentials in Admin > Integrations or via environment variables."
    );
  }

  _cachedConfig = config;
  return config;
}

function buildClient(config: S3Config): S3Client {
  if (_cachedClient) return _cachedClient;

  _cachedClient = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return _cachedClient;
}

function sseParams(config: S3Config): {
  ServerSideEncryption: ServerSideEncryption;
  SSEKMSKeyId?: string;
} {
  if (config.kmsKeyId) {
    return { ServerSideEncryption: "aws:kms", SSEKMSKeyId: config.kmsKeyId };
  }
  return { ServerSideEncryption: "AES256" };
}

/** Reset cached config (useful after saving new credentials via admin UI). */
export function resetS3Config(): void {
  _cachedConfig = null;
  _cachedClient = null;
}

/** Resolve the current bucket name from DB or env config. */
export async function getBucketName(): Promise<string> {
  const config = await resolveConfig();
  return config.bucketName;
}

/**
 * Verify S3 is configured and the bucket is reachable with current credentials.
 */
export async function getS3ConnectionStatus(): Promise<S3ConnectionStatus> {
  try {
    const config = await resolveConfig();
    const client = buildClient(config);

    await client.send(
      new HeadBucketCommand({
        Bucket: config.bucketName,
      })
    );

    return {
      configured: true,
      connected: true,
      message: null,
    };
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Unknown S3 connection error";
    const isNotConfigured = rawMessage.includes("AWS S3 is not configured");

    return {
      configured: !isNotConfigured,
      connected: false,
      message: isNotConfigured
        ? "AWS S3 is not configured yet."
        : "Unable to connect to AWS S3. Check bucket access and credentials.",
    };
  }
}

export function sanitizeS3KeyPart(input: string): string {
  // Keep it readable but safe for S3 keys.
  // Replace path separators and control chars; trim whitespace.
  return input
    .replace(/[\/\\]/g, "_")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 200);
}

export async function uploadObject(params: {
  key: string;
  body: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
  bucketName?: string;
}): Promise<{ bucket: string; key: string }> {
  const config = await resolveConfig();
  const client = buildClient(config);
  const sse = sseParams(config);

  const bucket = params.bucketName || config.bucketName;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
    Metadata: params.metadata,
    ...sse,
  });

  await client.send(command);
  return { bucket, key: params.key };
}

/**
 * Upload a signed contract to S3
 * @param contractId - Unique contract identifier
 * @param organizationId - Organization ID for path structure
 * @param fileBuffer - PDF file buffer
 * @param filename - Original filename
 * @returns S3 object key
 */
export async function uploadContract(
  contractId: string,
  organizationId: string,
  fileBuffer: Buffer,
  filename: string
): Promise<string> {
  const config = await resolveConfig();
  const client = buildClient(config);
  const sse = sseParams(config);

  const objectKey = `contracts/${organizationId}/${contractId}/${filename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: fileBuffer,
      ContentType: "application/pdf",
      ...sse,
      Metadata: {
        contractId,
        organizationId,
        uploadedAt: new Date().toISOString(),
      },
    });

    await client.send(command);
    return objectKey;
  } catch (error) {
    console.error("Error uploading contract to S3:", error);
    throw new Error(
      `Failed to upload contract: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Generate a presigned URL for temporary download access
 * @param objectKey - S3 object key
 * @param expiresIn - URL expiration time in seconds (default: 3600)
 * @returns Presigned URL
 */
export async function generatePresignedUrl(
  objectKey: string,
  expiresIn: number = 3600
): Promise<string> {
  const config = await resolveConfig();
  const client = buildClient(config);

  try {
    const command = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
    });

    const url = await getSignedUrl(client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    throw new Error(
      `Failed to generate presigned URL: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Delete a contract from S3
 * @param objectKey - S3 object key to delete
 */
export async function deleteContract(objectKey: string): Promise<void> {
  const config = await resolveConfig();
  const client = buildClient(config);

  try {
    const command = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
    });

    await client.send(command);
  } catch (error) {
    console.error("Error deleting contract from S3:", error);
    throw new Error(
      `Failed to delete contract: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get a contract buffer from S3
 * @param objectKey - S3 object key
 * @returns Contract file buffer
 */
export async function getContract(objectKey: string): Promise<Buffer> {
  const config = await resolveConfig();
  const client = buildClient(config);

  try {
    const command = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
    });

    const response = await client.send(command);

    if (!response.Body) {
      throw new Error("Empty response body from S3");
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error("Error getting contract from S3:", error);
    throw new Error(
      `Failed to get contract: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Generate a presigned URL for direct browser-to-S3 upload
 * @param key - S3 object key
 * @param contentType - MIME type of the file
 * @param expiresIn - URL expiration time in seconds (default: 900 = 15 min)
 * @returns Presigned upload URL
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 900
): Promise<string> {
  const config = await resolveConfig();
  const client = buildClient(config);
  const sse = sseParams(config);

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
    ...sse,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * List objects in S3 under a given prefix
 * @param prefix - S3 key prefix to list
 * @param maxKeys - Maximum number of keys to return (default: 100)
 * @param continuationToken - Token for pagination
 */
export async function listObjects(params: {
  prefix: string;
  maxKeys?: number;
  continuationToken?: string;
}): Promise<{
  objects: Array<{
    key: string;
    size: number;
    lastModified: Date | undefined;
  }>;
  nextToken: string | undefined;
  isTruncated: boolean;
}> {
  const config = await resolveConfig();
  const client = buildClient(config);

  const command = new ListObjectsV2Command({
    Bucket: config.bucketName,
    Prefix: params.prefix,
    MaxKeys: params.maxKeys ?? 100,
    ContinuationToken: params.continuationToken,
  });

  const response = await client.send(command);

  return {
    objects: (response.Contents ?? []).map((obj: { Key?: string; Size?: number; LastModified?: Date }) => ({
      key: obj.Key ?? "",
      size: obj.Size ?? 0,
      lastModified: obj.LastModified,
    })),
    nextToken: response.NextContinuationToken,
    isTruncated: response.IsTruncated ?? false,
  };
}

/**
 * Get metadata for an S3 object without downloading the body
 */
export async function headObject(key: string): Promise<{
  contentType: string | undefined;
  contentLength: number | undefined;
  lastModified: Date | undefined;
  metadata: Record<string, string> | undefined;
}> {
  const config = await resolveConfig();
  const client = buildClient(config);

  const command = new HeadObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  const response = await client.send(command);

  return {
    contentType: response.ContentType,
    contentLength: response.ContentLength,
    lastModified: response.LastModified,
    metadata: response.Metadata,
  };
}

/**
 * List "folders" (common prefixes) and objects at a given S3 prefix level.
 * Uses the Delimiter option to simulate a directory listing.
 */
export async function listFolders(params: {
  prefix: string;
  maxKeys?: number;
  continuationToken?: string;
}): Promise<{
  folders: Array<{ name: string; prefix: string }>;
  objects: Array<{
    key: string;
    name: string;
    size: number;
    lastModified: Date | undefined;
  }>;
  nextToken: string | undefined;
  isTruncated: boolean;
}> {
  const config = await resolveConfig();
  const client = buildClient(config);

  // Ensure prefix ends with /
  const normalizedPrefix = params.prefix.endsWith("/")
    ? params.prefix
    : params.prefix + "/";

  const command = new ListObjectsV2Command({
    Bucket: config.bucketName,
    Prefix: normalizedPrefix,
    Delimiter: "/",
    MaxKeys: params.maxKeys ?? 200,
    ContinuationToken: params.continuationToken,
  });

  const response = await client.send(command);

  const folders = (response.CommonPrefixes ?? []).map((cp) => {
    const fullPrefix = cp.Prefix ?? "";
    // Extract just the folder name from the prefix
    const parts = fullPrefix.replace(/\/$/, "").split("/");
    return {
      name: parts[parts.length - 1] || fullPrefix,
      prefix: fullPrefix,
    };
  });

  const objects = (response.Contents ?? [])
    .filter((obj) => {
      // Exclude the prefix itself (folder placeholder objects)
      return obj.Key !== normalizedPrefix;
    })
    .map((obj) => {
      const key = obj.Key ?? "";
      const parts = key.split("/");
      return {
        key,
        name: parts[parts.length - 1] || key,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified,
      };
    });

  return {
    folders,
    objects,
    nextToken: response.NextContinuationToken,
    isTruncated: response.IsTruncated ?? false,
  };
}

/**
 * Delete an object from S3 by key (generic version)
 */
export async function deleteObject(key: string): Promise<void> {
  const config = await resolveConfig();
  const client = buildClient(config);

  const command = new DeleteObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  await client.send(command);
}
