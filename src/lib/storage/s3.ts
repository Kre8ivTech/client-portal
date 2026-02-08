import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  type ServerSideEncryption,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Server-side encryption configuration.
 * Uses SSE-S3 (AES-256) by default. Set AWS_S3_KMS_KEY_ID env var
 * to enable SSE-KMS with a customer-managed key instead.
 */
const SSE_ALGORITHM: ServerSideEncryption = process.env.AWS_S3_KMS_KEY_ID
  ? "aws:kms"
  : "AES256";
const SSE_KMS_KEY_ID = process.env.AWS_S3_KMS_KEY_ID || undefined;

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "";

function requireS3Configured() {
  if (!BUCKET_NAME) {
    throw new Error("AWS_S3_BUCKET_NAME environment variable is not set");
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials are not configured");
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
  requireS3Configured();

  const bucket = params.bucketName || BUCKET_NAME;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
    Metadata: params.metadata,
    ServerSideEncryption: SSE_ALGORITHM,
    ...(SSE_KMS_KEY_ID ? { SSEKMSKeyId: SSE_KMS_KEY_ID } : {}),
  });

  await s3Client.send(command);
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
  requireS3Configured();

  const objectKey = `contracts/${organizationId}/${contractId}/${filename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
      Body: fileBuffer,
      ContentType: "application/pdf",
      ServerSideEncryption: SSE_ALGORITHM,
      ...(SSE_KMS_KEY_ID ? { SSEKMSKeyId: SSE_KMS_KEY_ID } : {}),
      Metadata: {
        contractId,
        organizationId,
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);
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
  requireS3Configured();

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
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
  requireS3Configured();

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });

    await s3Client.send(command);
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
  requireS3Configured();

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });

    const response = await s3Client.send(command);

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
  requireS3Configured();

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ServerSideEncryption: SSE_ALGORITHM,
    ...(SSE_KMS_KEY_ID ? { SSEKMSKeyId: SSE_KMS_KEY_ID } : {}),
  });

  return getSignedUrl(s3Client, command, { expiresIn });
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
  requireS3Configured();

  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: params.prefix,
    MaxKeys: params.maxKeys ?? 100,
    ContinuationToken: params.continuationToken,
  });

  const response = await s3Client.send(command);

  return {
    objects: (response.Contents ?? []).map((obj) => ({
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
  requireS3Configured();

  const command = new HeadObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);

  return {
    contentType: response.ContentType,
    contentLength: response.ContentLength,
    lastModified: response.LastModified,
    metadata: response.Metadata,
  };
}

/**
 * Delete an object from S3 by key (generic version)
 */
export async function deleteObject(key: string): Promise<void> {
  requireS3Configured();

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export { BUCKET_NAME, s3Client };
