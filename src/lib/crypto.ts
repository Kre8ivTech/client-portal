import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM
 */
export function encrypt(text: string): {
  encryptedData: string;
  iv: string;
  authTag: string;
} {
  const secretKey = process.env.ENCRYPTION_SECRET;
  if (!secretKey || secretKey.length < 32) {
    throw new Error("ENCRYPTION_SECRET must be at least 32 characters long");
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(secretKey.slice(0, 32)),
    iv,
  );

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag().toString("base64");

  return {
    encryptedData: encrypted,
    iv: iv.toString("base64"),
    authTag: authTag,
  };
}

/**
 * Decrypts a string using AES-256-GCM
 */
export function decrypt(
  encryptedData: string,
  ivBase64: string,
  authTagBase64: string,
): string {
  const secretKey = process.env.ENCRYPTION_SECRET;
  if (!secretKey || secretKey.length < 32) {
    throw new Error("ENCRYPTION_SECRET must be at least 32 characters long");
  }

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(secretKey.slice(0, 32)),
    iv,
  );

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
