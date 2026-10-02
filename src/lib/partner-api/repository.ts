import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { PartnerRepository, SiteMonitorRecord } from "@/lib/partner-api/dispatch";
import { wpPluginSchema, type WpPlugin } from "@/lib/partner-api/schemas";
import { normalizeSiteUrl, type PartnerKeyRecord, type PartnerOrgRecord } from "@/lib/partner-api/scope";

const ORG_COLUMNS = "id, name, slug, type, status, parent_org_id, custom_domain";
const MONITOR_COLUMNS =
  "id, organization_id, name, url, status, platform, wp_version, last_seen_at, wp_plugins, wp_plugins_updated_at, metadata";

function asPlugins(value: unknown): WpPlugin[] | null {
  if (value == null) return null;
  const parsed = z.array(wpPluginSchema).safeParse(value);
  return parsed.success ? parsed.data : null;
}

function asOrg(row: Record<string, unknown> | null): PartnerOrgRecord | null {
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    type: row.type == null ? null : String(row.type),
    status: row.status == null ? null : String(row.status),
    parent_org_id: row.parent_org_id == null ? null : String(row.parent_org_id),
    custom_domain: row.custom_domain == null ? null : String(row.custom_domain),
  };
}

function asMonitor(row: Record<string, unknown>): SiteMonitorRecord {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? (row.metadata as Record<string, unknown>)
    : {};
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    name: String(row.name ?? ""),
    url: String(row.url ?? ""),
    status: String(row.status ?? "unknown"),
    platform: row.platform == null ? null : String(row.platform),
    wp_version: row.wp_version == null ? null : String(row.wp_version),
    last_seen_at: row.last_seen_at == null ? null : String(row.last_seen_at),
    wp_plugins: asPlugins(row.wp_plugins),
    wp_plugins_updated_at: row.wp_plugins_updated_at == null ? null : String(row.wp_plugins_updated_at),
    metadata,
  };
}

export function createPartnerRepository(): PartnerRepository {
  const db = getSupabaseAdmin();

  return {
    async findKeyByHash(hash) {
      const { data, error } = await db
        .from("partner_api_keys")
        .select("id, organization_id, name, key_prefix, is_active, revoked_at")
        .eq("key_hash", hash)
        .maybeSingle();
      if (error || !data) return null;
      const row = data as Record<string, unknown>;
      const key: PartnerKeyRecord = {
        id: String(row.id),
        organization_id: String(row.organization_id),
        name: String(row.name ?? ""),
        key_prefix: String(row.key_prefix ?? ""),
        is_active: row.is_active !== false,
        revoked_at: row.revoked_at == null ? null : String(row.revoked_at),
      };
      return key;
    },

    async touchKey(id, usedAt) {
      await db.from("partner_api_keys").update({ last_used_at: usedAt }).eq("id", id);
    },

    async getOrganization(id) {
      const { data, error } = await db.from("organizations").select(ORG_COLUMNS).eq("id", id).maybeSingle();
      if (error) return null;
      return asOrg(data as Record<string, unknown> | null);
    },

    async listChildClients(partnerOrganizationId) {
      const { data, error } = await db
        .from("organizations")
        .select(ORG_COLUMNS)
        .eq("parent_org_id", partnerOrganizationId)
        .eq("type", "client")
        .order("name", { ascending: true });
      if (error) return [];
      return ((data ?? []) as Record<string, unknown>[]).map((row) => asOrg(row)!);
    },

    async listSiteMonitors(organizationIds) {
      if (organizationIds.length === 0) return [];
      const { data, error } = await db
        .from("site_monitors")
        .select(MONITOR_COLUMNS)
        .in("organization_id", organizationIds)
        .order("name", { ascending: true });
      if (error) return [];
      return ((data ?? []) as Record<string, unknown>[]).map(asMonitor);
    },

    async findSiteMonitorByUrl(organizationIds, url) {
      const monitors = await this.listSiteMonitors(organizationIds);
      const normalized = normalizeSiteUrl(url);
      return (
        monitors.find((monitor) => {
          try {
            return normalizeSiteUrl(monitor.url) === normalized;
          } catch {
            return monitor.url === url;
          }
        }) ?? null
      );
    },

    async insertSiteMonitor(row) {
      const { data, error } = await db
        .from("site_monitors")
        .insert({
          organization_id: row.organization_id,
          name: row.name,
          url: row.url,
          status: row.status,
          platform: row.platform,
          wp_version: row.wp_version,
          last_seen_at: row.last_seen_at,
          wp_plugins: row.wp_plugins,
          wp_plugins_updated_at: row.wp_plugins_updated_at,
          metadata: row.metadata,
        })
        .select(MONITOR_COLUMNS)
        .single();
      if (error || !data) throw new Error("Could not save the site monitor");
      return asMonitor(data as Record<string, unknown>);
    },

    async updateSiteMonitor(id, patch) {
      const { data, error } = await db
        .from("site_monitors")
        .update(patch)
        .eq("id", id)
        .select(MONITOR_COLUMNS)
        .single();
      if (error || !data) throw new Error("Could not update the site monitor");
      return asMonitor(data as Record<string, unknown>);
    },
  };
}
