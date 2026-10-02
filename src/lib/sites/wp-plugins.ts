import { z } from "zod";
import { wpPluginSchema, type WpPlugin } from "@/lib/partner-api/schemas";

export type WpPluginSummary = {
  active: number;
  inactive: number;
  updatesAvailable: number;
  total: number;
};

export type WordpressPluginStatus =
  | { available: false }
  | { available: true; plugins: WpPlugin[]; summary: WpPluginSummary; updatedAt: string };

export function summarizeWpPlugins(
  plugins: ReadonlyArray<{ active: boolean; update_available: boolean }>,
): WpPluginSummary {
  let active = 0;
  let updatesAvailable = 0;
  for (const plugin of plugins) {
    if (plugin.active) active += 1;
    if (plugin.update_available) updatesAvailable += 1;
  }
  const total = plugins.length;
  return {
    active,
    inactive: total - active,
    updatesAvailable,
    total,
  };
}

export function wordpressPluginStatus(input: {
  platform: string | null | undefined;
  plugins: unknown;
  updatedAt: string | null | undefined;
}): WordpressPluginStatus {
  const platform = (input.platform ?? "").trim().toLowerCase();
  if (platform !== "wordpress" || !input.updatedAt) {
    return { available: false };
  }

  const parsed = z.array(wpPluginSchema).safeParse(input.plugins);
  if (!parsed.success) return { available: false };

  return {
    available: true,
    plugins: parsed.data,
    summary: summarizeWpPlugins(parsed.data),
    updatedAt: input.updatedAt,
  };
}
