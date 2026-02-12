import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const MIN_SECRET_LENGTH = 32; // Increased from 8 to 32 characters

/**
 * Encrypts a string using AES-256-GCM with random salt per operation
 *
 * SECURITY: Each encryption operation uses a unique random salt to prevent
 * rainbow table attacks and ensure that identical plaintext produces different
 * ciphertext each time.
 */
export function encrypt(text: string): {
  encryptedData: string;
  iv: string;
  authTag: string;
  salt: string; // Added salt to return value
} {
  const secretKey = process.env.ENCRYPTION_SECRET;
  if (!secretKey || secretKey.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `ENCRYPTION_SECRET must be at least ${MIN_SECRET_LENGTH} characters long. ` +
      `Generate a secure key with: openssl rand -base64 32`
    );
  }

  // Generate random salt per encryption operation (SECURITY FIX)
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, "sha512");

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    derivedKey,
    iv,
  );

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag().toString("base64");

  return {
    encryptedData: encrypted,
    iv: iv.toString("base64"),
    authTag: authTag,
    salt: salt.toString("base64"), // Return salt for storage
  };
}

/**
 * Decrypts a string using AES-256-GCM with provided salt
 *
 * SECURITY: Requires the salt used during encryption to derive the same key.
 * This prevents decryption of data encrypted with different salts.
 *
 * @param encryptedData - Base64-encoded encrypted data
 * @param ivBase64 - Base64-encoded initialization vector
 * @param authTagBase64 - Base64-encoded authentication tag
 * @param saltBase64 - Base64-encoded salt (NEW - required for security)
 */
export function decrypt(
  encryptedData: string,
  ivBase64: string,
  authTagBase64: string,
  saltBase64: string, // NEW: Accept salt parameter
): string {
  const secretKey = process.env.ENCRYPTION_SECRET;
  if (!secretKey || secretKey.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `ENCRYPTION_SECRET must be at least ${MIN_SECRET_LENGTH} characters long. ` +
      `Generate a secure key with: openssl rand -base64 32`
    );
  }

  // Use the provided salt instead of static salt (SECURITY FIX)
  const salt = Buffer.from(saltBase64, "base64");
  const derivedKey = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, "sha512");

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    derivedKey,
    iv,
  );

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * BACKWARD COMPATIBILITY: Decrypt data encrypted with old static salt
 *
 * DEPRECATED: Only use for migrating legacy data. All new data should use
 * the new encrypt/decrypt functions with random salts.
 *
 * @deprecated Use decrypt() with salt parameter instead
 */
export function decryptLegacy(
  encryptedData: string,
  ivBase64: string,
  authTagBase64: string,
): string {
  const secretKey = process.env.ENCRYPTION_SECRET;
  if (!secretKey) {
    throw new Error("ENCRYPTION_SECRET is required");
  }

  // Use old static salt for backward compatibility
  const salt = "a-static-salt-for-key-derivation";
  const derivedKey = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, "sha512");

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    derivedKey,
    iv,
  );

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
