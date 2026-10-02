import { z } from "zod";

const httpsFlag = z.boolean().optional();

export const WP_PLUGIN_LIMIT = 200;

const pluginFileSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => !value.includes("..") && !value.includes("\\") && !value.includes("\0"), {
    message: "Invalid plugin file",
  });

export const wpPluginSchema = z.object({
  file: pluginFileSchema,
  name: z.string().trim().min(1).max(200),
  version: z.string().trim().max(40).optional().default(""),
  active: z.boolean(),
  update_available: z.boolean().optional().default(false),
});

export type WpPlugin = z.infer<typeof wpPluginSchema>;

const wpPluginListSchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return value;
  return value.slice(0, WP_PLUGIN_LIMIT);
}, z.array(wpPluginSchema).max(WP_PLUGIN_LIMIT).optional());

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
  plugins: wpPluginListSchema,
});

export type CreateSiteMonitorInput = z.infer<typeof createSiteMonitorSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
