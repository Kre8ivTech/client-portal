// @vitest-environment node
import { describe, expect, it } from "vitest";
import { compareSiteMonitors, siteMonitorIssueRank, sslState } from "@/lib/sites/site-monitor-display";

const now = new Date(2026, 9, 2, 15, 0, 0);

const plugin = {
  file: "akismet/akismet.php",
  name: "Akismet",
  version: "5.3",
  active: true,
  update_available: true,
};

function row(overrides: Partial<Parameters<typeof compareSiteMonitors>[0]> & { name: string; status: string }) {
  return {
    ssl_expiry_date: "2026-12-01",
    platform: "wordpress",
    wp_plugins: null,
    wp_plugins_updated_at: null,
    ...overrides,
  };
}

describe("site monitor issue order", () => {
  it("places down, expired SSL, degraded, expiring SSL, and plugin updates ahead of unknown and healthy sites", () => {
    const sites = [
      row({ name: "Healthy", status: "up" }),
      row({ name: "Unchecked", status: "unknown", ssl_expiry_date: null }),
      row({
        name: "Plugin updates",
        status: "up",
        wp_plugins: [plugin],
        wp_plugins_updated_at: "2026-10-02T14:00:00.000Z",
      }),
      row({ name: "SSL soon", status: "up", ssl_expiry_date: "2026-10-10" }),
      row({ name: "Slow", status: "degraded" }),
      row({ name: "Cert dead", status: "up", ssl_expiry_date: "2026-09-01" }),
      row({ name: "Offline", status: "down" }),
    ];

    const ordered = [...sites].sort((a, b) => compareSiteMonitors(a, b, now)).map((site) => site.name);

    expect(ordered).toEqual([
      "Offline",
      "Cert dead",
      "Slow",
      "SSL soon",
      "Plugin updates",
      "Unchecked",
      "Healthy",
    ]);
    expect(siteMonitorIssueRank(sites[0], now)).toBeGreaterThan(siteMonitorIssueRank(sites[6], now));
  });

  it("breaks ties by site name and treats a missing plugin snapshot as not an update issue", () => {
    const alpha = row({ name: "Beta", status: "up", platform: "wordpress", wp_plugins: [plugin], wp_plugins_updated_at: null });
    const beta = row({ name: "alpha", status: "up" });
    expect(compareSiteMonitors(alpha, beta, now)).toBeGreaterThan(0);
    expect(sslState("2026-10-02", now)).toBe("expiring_soon");
    expect(sslState(null, now)).toBe("unknown");
    expect(sslState("not-a-date", now)).toBe("unknown");
  });
});
