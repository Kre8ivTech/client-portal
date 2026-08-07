import { z } from "zod";
import { ERROR_LOG_SOURCES } from "@/lib/error-logs";

export const errorLogSchema = z
  .object({
    message: z.string().trim().min(1).max(2_000),
    stack: z.string().max(12_000).optional(),
    digest: z.string().trim().max(255).optional(),
    route: z.string().max(500).optional(),
    source: z.enum(ERROR_LOG_SOURCES),
    context: z
      .object({
        filename: z.string().max(1_000).optional(),
        line: z.number().int().nonnegative().max(10_000_000).optional(),
        column: z.number().int().nonnegative().max(10_000_000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
