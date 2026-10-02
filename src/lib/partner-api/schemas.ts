import { z } from "zod";

const httpsFlag = z.boolean().optional();

export const createSiteMonitorSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  url: z.string().trim().url().max(300),
  platform: z.string().trim().max(80).optional().default(""),
  wp_version: z.string().trim().max(40).optional(),
  https: httpsFlag,
});

export const heartbeatSchema = z.object({
  url: z.string().trim().url().max(300),
  name: z.string().trim().min(2).max(120).optional(),
  organization_id: z.string().uuid().optional(),
  wp_version: z.string().trim().max(40).optional(),
  https: httpsFlag,
  platform: z.string().trim().max(80).optional().default("wordpress"),
});

export type CreateSiteMonitorInput = z.infer<typeof createSiteMonitorSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
