// @vitest-environment node
import { describe, expect, it } from "vitest";
import { WP_PLUGIN_LIMIT, heartbeatSchema } from "@/lib/partner-api/schemas";
import { summarizeWpPlugins, wordpressPluginStatus } from "@/lib/sites/wp-plugins";

const siteUrl = "https://child.example";

function plugin(index: number, overrides?: Partial<{ active: boolean; update_available: boolean; name: string }>) {
  return {
    file: `plugin-${index}/plugin.php`,
    name: overrides?.name ?? `Plugin ${index}`,
    version: "1.0.0",
    active: overrides?.active ?? index % 2 === 0,
    update_available: overrides?.update_available ?? false,
  };
}

describe("WordPress plugin heartbeat payload", () => {
  it("accepts plugin status and drops license keys and source", () => {
    const parsed = heartbeatSchema.parse({
      url: siteUrl,
      plugins: [
        {
          file: "akismet/akismet.php",
          name: "Akismet",
          version: "5.3",
          active: true,
          update_available: true,
          license_key: "secret-license",
          source: "<?php echo 'plugin source';",
          contents: "full file contents",
        },
      ],
    });

    expect(parsed.plugins).toEqual([
      {
        file: "akismet/akismet.php",
        name: "Akismet",
        version: "5.3",
        active: true,
        update_available: true,
      },
    ]);
    expect(JSON.stringify(parsed.plugins)).not.toContain("secret-license");
    expect(JSON.stringify(parsed.plugins)).not.toContain("plugin source");
  });

  it("rejects a plugin that is missing a name, has a non-boolean active flag, or is not a list", () => {
    expect(
      heartbeatSchema.safeParse({
        url: siteUrl,
        plugins: [{ file: "hello.php", version: "1", active: true }],
      }).success,
    ).toBe(false);
    expect(
      heartbeatSchema.safeParse({
        url: siteUrl,
        plugins: [{ file: "hello.php", name: "Hello", active: "yes" }],
      }).success,
    ).toBe(false);
    expect(heartbeatSchema.safeParse({ url: siteUrl, plugins: { file: "hello.php" } }).success).toBe(false);
    expect(
      heartbeatSchema.safeParse({
        url: siteUrl,
        plugins: [{ file: "../wp-config.php", name: "Config", active: true }],
      }).success,
    ).toBe(false);
  });

  it("caps the plugin list at 200 entries", () => {
    const plugins = Array.from({ length: WP_PLUGIN_LIMIT + 25 }, (_, index) => plugin(index));
    const parsed = heartbeatSchema.parse({ url: siteUrl, plugins });
    expect(parsed.plugins).toHaveLength(WP_PLUGIN_LIMIT);
    expect(parsed.plugins?.[0]?.name).toBe("Plugin 0");
    expect(parsed.plugins?.some((entry) => entry.name === `Plugin ${WP_PLUGIN_LIMIT}`)).toBe(false);
  });
});

describe("WordPress plugin summary", () => {
  it("counts active, inactive, and updates available", () => {
    const summary = summarizeWpPlugins([
      { active: true, update_available: true },
      { active: true, update_available: false },
      { active: false, update_available: true },
      { active: false, update_available: false },
    ]);
    expect(summary).toEqual({ active: 2, inactive: 2, updatesAvailable: 2, total: 4 });
  });

  it("is unavailable until a WordPress site has a plugin snapshot", () => {
    const plugins = [{ file: "hello.php", name: "Hello Dolly", version: "1.7.2", active: false, update_available: false }];
    expect(wordpressPluginStatus({ platform: "static", plugins, updatedAt: "2026-10-02T00:00:00.000Z" })).toEqual({
      available: false,
    });
    expect(wordpressPluginStatus({ platform: "wordpress", plugins, updatedAt: null })).toEqual({ available: false });
    expect(wordpressPluginStatus({ platform: "WordPress", plugins: "not-a-list", updatedAt: "2026-10-02T00:00:00.000Z" })).toEqual({
      available: false,
    });

    const ready = wordpressPluginStatus({
      platform: "WordPress",
      plugins,
      updatedAt: "2026-10-02T00:00:00.000Z",
    });
    expect(ready.available).toBe(true);
    if (ready.available) {
      expect(ready.summary).toEqual({ active: 0, inactive: 1, updatesAvailable: 0, total: 1 });
    }
  });
});
