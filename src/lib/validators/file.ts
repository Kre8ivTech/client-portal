import { z } from "zod";

/** Maximum file size: 50 MB */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Allowed MIME types for direct uploads */
export const ALLOWED_MIME_TYPES = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Archives
  "application/zip",
  "application/gzip",
] as const;

export const fileUploadSchema = z.object({
  name: z
    .string()
    .min(1, "File name is required")
    .max(255, "File name must be 255 characters or fewer"),
  contentType: z
    .string()
    .refine(
      (val: string) => (ALLOWED_MIME_TYPES as readonly string[]).includes(val),
      "File type not allowed"
    ),
  size: z
    .number()
    .int()
    .positive("File size must be positive")
    .max(MAX_FILE_SIZE_BYTES, "File must be 50 MB or smaller"),
});

export type FileUploadInput = z.infer<typeof fileUploadSchema>;

export const fileListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().max(200).optional(),
});

export type FileListQuery = z.infer<typeof fileListQuerySchema>;
