// @vitest-environment node
import { describe, expect, it } from "vitest";
import { dispatchPartnerApi, type PartnerRepository, type SiteMonitorRecord } from "@/lib/partner-api/dispatch";
import { generatePartnerApiKey, hashPartnerApiKey } from "@/lib/partner-api/keys";
import {
  apiKeyCanAttachSiteMonitor,
  normalizeSiteUrl,
  type PartnerKeyRecord,
  type PartnerOrgRecord,
} from "@/lib/partner-api/scope";
import { createSiteMonitorSchema, heartbeatSchema } from "@/lib/partner-api/schemas";
import {
  mergeProviderFields,
  marketingProvider,
  resolveGoogleAdsCredentialSet,
} from "@/lib/marketing/providers";

const partnerOrg: PartnerOrgRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "North Partner",
  slug: "north",
  type: "partner",
  status: "active",
  parent_org_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  custom_domain: null,
};

const otherPartner: PartnerOrgRecord = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Other Partner",
  slug: "other",
  type: "partner",
  status: "active",
  parent_org_id: partnerOrg.parent_org_id,
  custom_domain: null,
};

const child: PartnerOrgRecord = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Child Client",
  slug: "child",
  type: "client",
  status: "active",
  parent_org_id: partnerOrg.id,
  custom_domain: null,
};

const foreignChild: PartnerOrgRecord = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Foreign Client",
  slug: "foreign",
  type: "client",
  status: "active",
  parent_org_id: otherPartner.id,
  custom_domain: null,
};

function memoryRepo(options?: { revoke?: boolean }): { repo: PartnerRepository; key: string; monitors: SiteMonitorRecord[] } {
  const key = generatePartnerApiKey();
  const monitors: SiteMonitorRecord[] = [];
  const orgs = [partnerOrg, otherPartner, child, foreignChild];
  const keyRow: PartnerKeyRecord = {
    id: "55555555-5555-4555-8555-555555555555",
    organization_id: partnerOrg.id,
    name: "WordPress",
    key_prefix: key.slice(0, 12),
    is_active: !options?.revoke,
    revoked_at: options?.revoke ? new Date().toISOString() : null,
  };

  const repo: PartnerRepository = {
    async findKeyByHash(hash) {
      return hash === hashPartnerApiKey(key) ? keyRow : null;
    },
    async touchKey() {},
    async getOrganization(id) {
      return orgs.find((org) => org.id === id) ?? null;
    },
    async listChildClients(partnerOrganizationId) {
      return orgs.filter((org) => org.parent_org_id === partnerOrganizationId && org.type === "client");
    },
    async listSiteMonitors(organizationIds) {
      return monitors.filter((monitor) => organizationIds.includes(monitor.organization_id));
    },
    async findSiteMonitorByUrl(organizationIds, url) {
      const normalized = normalizeSiteUrl(url);
      return (
        monitors.find(
          (monitor) =>
            organizationIds.includes(monitor.organization_id) && normalizeSiteUrl(monitor.url) === normalized,
        ) ?? null
      );
    },
    async insertSiteMonitor(row) {
      const saved: SiteMonitorRecord = { ...row, id: `monitor-${monitors.length + 1}` };
      monitors.push(saved);
      return saved;
    },
    async updateSiteMonitor(id, patch) {
      const index = monitors.findIndex((monitor) => monitor.id === id);
      monitors[index] = { ...monitors[index], ...patch };
      return monitors[index];
    },
  };

  return { repo, key, monitors };
}

describe("partner API auth scoping", () => {
  it("rejects a missing, foreign, or revoked key", async () => {
    const { repo } = memoryRepo();
    const missing = await dispatchPartnerApi({ method: "GET", path: "/whoami", authorization: null }, repo);
    expect(missing.status).toBe(401);

    const foreign = await dispatchPartnerApi(
      { method: "GET", path: "/clients", authorization: "Bearer ktp_not-a-real-key" },
      repo,
    );
    expect(foreign.status).toBe(401);

    const revoked = memoryRepo({ revoke: true });
    const denied = await dispatchPartnerApi(
      { method: "GET", path: "/whoami", authorization: `Bearer ${revoked.key}` },
      revoked.repo,
    );
    expect(denied.status).toBe(401);
  });

  it("lists only the key organization's child clients", async () => {
    const { repo, key } = memoryRepo();
    const whoami = await dispatchPartnerApi(
      { method: "GET", path: "/whoami", authorization: `Bearer ${key}` },
      repo,
    );
    expect(whoami.status).toBe(200);
    expect(whoami.body.organization).toMatchObject({ id: partnerOrg.id, name: "North Partner" });
    expect(JSON.stringify(whoami.body)).not.toContain(key);

    const clients = await dispatchPartnerApi(
      { method: "GET", path: "/clients", authorization: `Bearer ${key}` },
      repo,
    );
    expect(clients.status).toBe(200);
    const ids = (clients.body.data as Array<{ id: string }>).map((row) => row.id);
    expect(ids).toEqual([child.id]);
    expect(ids).not.toContain(foreignChild.id);
  });

  it("refuses a site on another partner's client and accepts a child client", async () => {
    const { repo, key, monitors } = memoryRepo();
    const forbidden = await dispatchPartnerApi(
      {
        method: "POST",
        path: "/sites",
        authorization: `Bearer ${key}`,
        body: { organization_id: foreignChild.id, name: "Foreign", url: "https://foreign.example" },
      },
      repo,
    );
    expect(forbidden.status).toBe(403);
    expect(monitors).toHaveLength(0);

    const created = await dispatchPartnerApi(
      {
        method: "POST",
        path: "/sites",
        authorization: `Bearer ${key}`,
        body: {
          organization_id: child.id,
          name: "Child Site",
          url: "https://child.example/",
          platform: "wordpress",
          wp_version: "6.6.2",
          https: true,
        },
      },
      repo,
    );
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      organization_id: child.id,
      url: "https://child.example",
      wp_version: "6.6.2",
      https: true,
    });

    const listed = await dispatchPartnerApi(
      { method: "GET", path: "/sites", authorization: `Bearer ${key}` },
      repo,
    );
    expect(listed.body.data).toHaveLength(1);
  });

  it("stores a heartbeat on the matching child monitor", async () => {
    const { repo, key, monitors } = memoryRepo();
    await dispatchPartnerApi(
      {
        method: "POST",
        path: "/sites",
        authorization: `Bearer ${key}`,
        body: { organization_id: child.id, name: "Child Site", url: "https://child.example" },
      },
      repo,
    );

    const beat = await dispatchPartnerApi(
      {
        method: "POST",
        path: "/sites/heartbeat",
        authorization: `Bearer ${key}`,
        body: {
          url: "https://child.example/",
          wp_version: "6.7",
          organization_id: child.id,
          https: true,
        },
      },
      repo,
    );
    expect(beat.status).toBe(200);
    expect(beat.body.data).toMatchObject({ wp_version: "6.7", created: false, last_seen_at: expect.any(String) });
    expect(monitors[0].last_seen_at).toEqual((beat.body.data as { last_seen_at: string }).last_seen_at);
    expect(monitors[0].wp_plugins).toBeNull();

    const outside = await dispatchPartnerApi(
      {
        method: "POST",
        path: "/sites/heartbeat",
        authorization: `Bearer ${key}`,
        body: { url: "https://foreign.example", organization_id: foreignChild.id, wp_version: "6.7" },
      },
      repo,
    );
    expect(outside.status).toBe(403);
  });

  it("replaces the WordPress plugin snapshot and leaves it when a heartbeat omits plugins", async () => {
    const { repo, key, monitors } = memoryRepo();
    const authorization = `Bearer ${key}`;
    const first = [
      { file: "akismet/akismet.php", name: "Akismet", version: "5.3", active: true, update_available: false },
      { file: "hello.php", name: "Hello Dolly", version: "1.7.2", active: false, update_available: true },
    ];
    const created = await dispatchPartnerApi(
      {
        method: "POST",
        path: "/sites/heartbeat",
        authorization,
        body: {
          url: "https://child.example",
          organization_id: child.id,
          name: "Child Site",
          platform: "wordpress",
          plugins: first,
        },
      },
      repo,
    );
    expect(created.status).toBe(201);
    expect(monitors[0].wp_plugins).toEqual(first);
    expect(monitors[0].wp_plugins_updated_at).toEqual((created.body.data as { wp_plugins_updated_at: string }).wp_plugins_updated_at);

    const replacement = [
      { file: "seo/seo.php", name: "SEO", version: "2.0", active: true, update_available: true, license_key: "do-not-store" },
    ];
    const replaced = await dispatchPartnerApi(
      {
        method: "POST",
        path: "/sites/heartbeat",
        authorization,
        body: { url: "https://child.example/", organization_id: child.id, plugins: replacement },
      },
      repo,
    );
    expect(replaced.status).toBe(200);
    expect(monitors[0].wp_plugins).toEqual([
      { file: "seo/seo.php", name: "SEO", version: "2.0", active: true, update_available: true },
    ]);
    expect(JSON.stringify(monitors[0].wp_plugins)).not.toContain("do-not-store");

    const seenAt = monitors[0].wp_plugins_updated_at;
    const omitted = await dispatchPartnerApi(
      {
        method: "POST",
        path: "/sites/heartbeat",
        authorization,
        body: { url: "https://child.example", organization_id: child.id, wp_version: "6.7.1" },
      },
      repo,
    );
    expect(omitted.status).toBe(200);
    expect(monitors[0].wp_plugins).toEqual([
      { file: "seo/seo.php", name: "SEO", version: "2.0", active: true, update_available: true },
    ]);
    expect(monitors[0].wp_plugins_updated_at).toBe(seenAt);
    expect(monitors[0].wp_version).toBe("6.7.1");

    const listed = await dispatchPartnerApi({ method: "GET", path: "/sites", authorization }, repo);
    const rows = listed.body.data as Array<{ organization_id: string; wp_plugins: unknown }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].organization_id).toBe(child.id);
    expect(rows[0].wp_plugins).toEqual(monitors[0].wp_plugins);
  });

  it("answers health without a key and keeps platform keys inside their own children", async () => {
    const { repo } = memoryRepo();
    const health = await dispatchPartnerApi({ method: "GET", path: "/health", authorization: null }, repo);
    expect(health).toEqual({ status: 200, body: { ok: true, service: "partner-api", version: "v1" } });

    expect(apiKeyCanAttachSiteMonitor({
      actorOrganizationId: partnerOrg.id,
      actorOrganizationType: "kre8ivtech",
      target: { parentOrgId: partnerOrg.id, type: "client" },
    })).toBe(true);
    expect(apiKeyCanAttachSiteMonitor({
      actorOrganizationId: partnerOrg.id,
      actorOrganizationType: "partner",
      target: { parentOrgId: otherPartner.id, type: "client" },
    })).toBe(false);
  });
});

describe("monitor payload", () => {
  it("accepts a WordPress registration and rejects a bad URL", () => {
    const parsed = createSiteMonitorSchema.parse({
      organization_id: child.id,
      name: "Example",
      url: "https://example.com",
      platform: "wordpress",
      wp_version: "6.6",
      https: true,
    });
    expect(parsed.wp_version).toBe("6.6");
    expect(normalizeSiteUrl("https://Example.com/path/")).toBe("https://example.com/path");
    expect(heartbeatSchema.safeParse({ url: "not a url" }).success).toBe(false);
    expect(createSiteMonitorSchema.safeParse({ organization_id: "nope", name: "A", url: "https://example.com" }).success).toBe(false);
  });
});

describe("marketing credential merge", () => {
  it("keeps a saved secret when the field is left blank and does not mix pairs", () => {
    const provider = marketingProvider("google_ads");
    expect(provider).not.toBeNull();
    const merged = mergeProviderFields(
      provider!,
      { client_id: "client-1", client_secret: "", developer_token: "" },
      { client_id: "old", client_secret: "secret-value", developer_token: "dev-token" },
    );
    expect(merged.client_id).toBe("client-1");
    expect(merged.client_secret).toBe("secret-value");
    expect(merged.developer_token).toBe("dev-token");

    expect(resolveGoogleAdsCredentialSet({
      stored: { client_id: "org-client", client_secret: "", developer_token: "org-dev" },
      envClientId: "env-client",
      envClientSecret: "env-secret",
      envDeveloperToken: "env-dev",
    })).toBeNull();

    expect(resolveGoogleAdsCredentialSet({
      stored: { developer_token: "org-dev" },
      envClientId: "env-client",
      envClientSecret: "env-secret",
      envDeveloperToken: "env-dev",
    })).toEqual({ clientId: "env-client", clientSecret: "env-secret", developerToken: "org-dev" });

    expect(resolveGoogleAdsCredentialSet({
      stored: { client_id: "org-client", client_secret: "org-secret", developer_token: "org-dev" },
      envClientId: "env-client",
      envClientSecret: "env-secret",
      envDeveloperToken: "env-dev",
    })).toEqual({ clientId: "org-client", clientSecret: "org-secret", developerToken: "org-dev" });
  });
});
