import { hashPartnerApiKey, readBearerToken } from "@/lib/partner-api/keys";
import {
  PARTNER_SITE_TARGET_ERROR,
  apiKeyCanAttachSiteMonitor,
  isChildClientOf,
  normalizeSiteUrl,
  partnerKeyIsUsable,
  type PartnerKeyRecord,
  type PartnerOrgRecord,
} from "@/lib/partner-api/scope";
import { createSiteMonitorSchema, heartbeatSchema, type WpPlugin } from "@/lib/partner-api/schemas";

export type SiteMonitorRecord = {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  status: string;
  platform: string | null;
  wp_version: string | null;
  last_seen_at: string | null;
  wp_plugins: WpPlugin[] | null;
  wp_plugins_updated_at: string | null;
  metadata: Record<string, unknown>;
};

export type PartnerRepository = {
  findKeyByHash(hash: string): Promise<PartnerKeyRecord | null>;
  touchKey(id: string, usedAt: string): Promise<void>;
  getOrganization(id: string): Promise<PartnerOrgRecord | null>;
  listChildClients(partnerOrganizationId: string): Promise<PartnerOrgRecord[]>;
  listSiteMonitors(organizationIds: string[]): Promise<SiteMonitorRecord[]>;
  findSiteMonitorByUrl(organizationIds: string[], url: string): Promise<SiteMonitorRecord | null>;
  insertSiteMonitor(row: Omit<SiteMonitorRecord, "id"> & { id?: string }): Promise<SiteMonitorRecord>;
  updateSiteMonitor(
    id: string,
    patch: Partial<
      Pick<
        SiteMonitorRecord,
        "name" | "url" | "platform" | "wp_version" | "last_seen_at" | "wp_plugins" | "wp_plugins_updated_at" | "metadata"
      >
    >,
  ): Promise<SiteMonitorRecord>;
};

export type PartnerApiResult = {
  status: number;
  body: Record<string, unknown>;
};

type Authed = {
  key: PartnerKeyRecord;
  organization: PartnerOrgRecord;
};

function unauthorized(): PartnerApiResult {
  return { status: 401, body: { error: "Unauthorized" } };
}

function publicOrg(org: PartnerOrgRecord) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    type: org.type,
    status: org.status,
    custom_domain: org.custom_domain,
  };
}

function publicMonitor(monitor: SiteMonitorRecord) {
  const https = typeof monitor.metadata.https === "boolean" ? monitor.metadata.https : monitor.url.startsWith("https://");
  return {
    id: monitor.id,
    organization_id: monitor.organization_id,
    name: monitor.name,
    url: monitor.url,
    status: monitor.status,
    platform: monitor.platform,
    wp_version: monitor.wp_version,
    last_seen_at: monitor.last_seen_at,
    wp_plugins: monitor.wp_plugins,
    wp_plugins_updated_at: monitor.wp_plugins_updated_at,
    https,
  };
}

function pluginSnapshot(plugins: WpPlugin[] | undefined, seenAt: string): Pick<SiteMonitorRecord, "wp_plugins" | "wp_plugins_updated_at"> {
  if (plugins === undefined) {
    return { wp_plugins: null, wp_plugins_updated_at: null };
  }
  return { wp_plugins: plugins, wp_plugins_updated_at: seenAt };
}

function monitorMetadata(https: boolean | undefined, url: string, source: string): Record<string, unknown> {
  return {
    https: https ?? url.startsWith("https://"),
    source,
  };
}

async function authenticate(
  authorization: string | null,
  repo: PartnerRepository,
): Promise<{ ok: true; auth: Authed } | { ok: false; result: PartnerApiResult }> {
  const token = readBearerToken(authorization);
  if (!token) return { ok: false, result: unauthorized() };

  const key = await repo.findKeyByHash(hashPartnerApiKey(token));
  if (!partnerKeyIsUsable(key)) return { ok: false, result: unauthorized() };

  const organization = await repo.getOrganization(key.organization_id);
  if (!organization) return { ok: false, result: unauthorized() };
  if (organization.type !== "partner" && organization.type !== "kre8ivtech") {
    return { ok: false, result: unauthorized() };
  }

  await repo.touchKey(key.id, new Date().toISOString());
  return { ok: true, auth: { key, organization } };
}

async function childIds(repo: PartnerRepository, partnerOrganizationId: string): Promise<string[]> {
  const clients = await repo.listChildClients(partnerOrganizationId);
  return clients.filter((client) => isChildClientOf(client, partnerOrganizationId)).map((client) => client.id);
}

export async function dispatchPartnerApi(
  input: {
    method: string;
    path: string;
    authorization: string | null;
    body?: unknown;
  },
  repo: PartnerRepository,
): Promise<PartnerApiResult> {
  const method = input.method.toUpperCase();
  const path = input.path.replace(/\/+$/, "") || "/";

  if (method === "GET" && path === "/health") {
    return { status: 200, body: { ok: true, service: "partner-api", version: "v1" } };
  }

  const authed = await authenticate(input.authorization, repo);
  if (!authed.ok) return authed.result;
  const { key, organization } = authed.auth;

  if (method === "GET" && (path === "/whoami" || path === "/organization")) {
    return {
      status: 200,
      body: {
        api: "partner",
        version: "v1",
        organization: publicOrg(organization),
        key: { id: key.id, name: key.name, prefix: key.key_prefix },
      },
    };
  }

  if (method === "GET" && path === "/clients") {
    const clients = (await repo.listChildClients(organization.id)).filter((client) =>
      isChildClientOf(client, organization.id),
    );
    return { status: 200, body: { data: clients.map(publicOrg) } };
  }

  if (method === "GET" && path === "/sites") {
    const ids = await childIds(repo, organization.id);
    const monitors = ids.length ? await repo.listSiteMonitors(ids) : [];
    return { status: 200, body: { data: monitors.map(publicMonitor) } };
  }

  if (method === "POST" && path === "/sites") {
    const parsed = createSiteMonitorSchema.safeParse(input.body ?? {});
    if (!parsed.success) {
      return { status: 400, body: { error: "Validation failed", details: parsed.error.flatten() } };
    }

    const target = await repo.getOrganization(parsed.data.organization_id);
    const allowed = apiKeyCanAttachSiteMonitor({
      actorOrganizationId: organization.id,
      actorOrganizationType: organization.type,
      target: target ? { parentOrgId: target.parent_org_id, type: target.type } : null,
    });
    if (!allowed) return { status: 403, body: { error: PARTNER_SITE_TARGET_ERROR } };

    const url = normalizeSiteUrl(parsed.data.url);
    const existing = await repo.findSiteMonitorByUrl([target!.id], url);
    const seenAt = new Date().toISOString();
    const metadata = monitorMetadata(parsed.data.https, url, "partner_api");
    const saved = existing
      ? await repo.updateSiteMonitor(existing.id, {
          name: parsed.data.name,
          url,
          platform: parsed.data.platform || existing.platform,
          wp_version: parsed.data.wp_version ?? existing.wp_version,
          last_seen_at: seenAt,
          metadata: { ...existing.metadata, ...metadata },
        })
      : await repo.insertSiteMonitor({
          organization_id: target!.id,
          name: parsed.data.name,
          url,
          status: "unknown",
          platform: parsed.data.platform || null,
          wp_version: parsed.data.wp_version ?? null,
          last_seen_at: seenAt,
          ...pluginSnapshot(undefined, seenAt),
          metadata,
        });

    return { status: existing ? 200 : 201, body: { data: publicMonitor(saved) } };
  }

  if (method === "POST" && path === "/sites/heartbeat") {
    const parsed = heartbeatSchema.safeParse(input.body ?? {});
    if (!parsed.success) {
      return { status: 400, body: { error: "Validation failed", details: parsed.error.flatten() } };
    }

    const ids = await childIds(repo, organization.id);
    if (parsed.data.organization_id && !ids.includes(parsed.data.organization_id)) {
      return { status: 403, body: { error: PARTNER_SITE_TARGET_ERROR } };
    }

    const url = normalizeSiteUrl(parsed.data.url);
    const searchIds = parsed.data.organization_id ? [parsed.data.organization_id] : ids;
    const existing = searchIds.length ? await repo.findSiteMonitorByUrl(searchIds, url) : null;
    const seenAt = new Date().toISOString();
    const metadata = monitorMetadata(parsed.data.https, url, "heartbeat");

    const plugins = pluginSnapshot(parsed.data.plugins, seenAt);
    const pluginPatch = parsed.data.plugins === undefined ? {} : plugins;

    if (existing) {
      const saved = await repo.updateSiteMonitor(existing.id, {
        name: parsed.data.name ?? existing.name,
        url,
        platform: parsed.data.platform || existing.platform,
        wp_version: parsed.data.wp_version ?? existing.wp_version,
        last_seen_at: seenAt,
        ...pluginPatch,
        metadata: { ...existing.metadata, ...metadata },
      });
      return { status: 200, body: { data: { ...publicMonitor(saved), created: false } } };
    }

    if (!parsed.data.organization_id) {
      return {
        status: 404,
        body: { error: "No site monitor matches that URL. Send organization_id to register the site." },
      };
    }

    const target = await repo.getOrganization(parsed.data.organization_id);
    const allowed = apiKeyCanAttachSiteMonitor({
      actorOrganizationId: organization.id,
      actorOrganizationType: organization.type,
      target: target ? { parentOrgId: target.parent_org_id, type: target.type } : null,
    });
    if (!allowed) return { status: 403, body: { error: PARTNER_SITE_TARGET_ERROR } };

    const saved = await repo.insertSiteMonitor({
      organization_id: target!.id,
      name: parsed.data.name || new URL(url).host,
      url,
      status: "unknown",
      platform: parsed.data.platform || "wordpress",
      wp_version: parsed.data.wp_version ?? null,
      last_seen_at: seenAt,
      ...plugins,
      metadata,
    });
    return { status: 201, body: { data: { ...publicMonitor(saved), created: true } } };
  }

  return { status: 404, body: { error: "Not found" } };
}
