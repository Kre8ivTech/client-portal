// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  WORDPRESS_PLUGIN_BOOTSTRAP,
  buildWordPressPluginZip,
  canDownloadWordPressPlugin,
  readZipEntries,
  shouldPackagePluginPath,
  wordpressPluginDownloadDecision,
  wordpressPluginSourceDir,
} from "@/lib/sites/wordpress-plugin-package";

const SECRET_MARKERS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "BEGIN PRIVATE KEY",
  "BEGIN RSA PRIVATE KEY",
  "sk_live_",
];

describe("wordpress plugin download access", () => {
  it("allows partners and platform staff", () => {
    for (const role of ["partner", "partner_staff", "staff", "super_admin"]) {
      expect(canDownloadWordPressPlugin(role)).toBe(true);
      expect(wordpressPluginDownloadDecision({ userId: "user-1", role })).toBe("allow");
    }
  });

  it("rejects anonymous callers and clients", () => {
    expect(wordpressPluginDownloadDecision({ userId: null, role: "partner" })).toBe("unauthorized");
    expect(wordpressPluginDownloadDecision({ userId: null, role: null })).toBe("unauthorized");
    expect(wordpressPluginDownloadDecision({ userId: "user-1", role: "client" })).toBe("forbidden");
    expect(wordpressPluginDownloadDecision({ userId: "user-1", role: null })).toBe("forbidden");
    expect(canDownloadWordPressPlugin("client")).toBe(false);
    expect(canDownloadWordPressPlugin("admin")).toBe(false);
  });

  it("treats the legacy admin role as super_admin", () => {
    expect(wordpressPluginDownloadDecision({ userId: "user-1", role: "admin" })).toBe("allow");
  });
});

describe("wordpress plugin zip", () => {
  it("skips git metadata, dependencies, and secret files", () => {
    expect(shouldPackagePluginPath("kt-portal-monitor.php")).toBe(true);
    expect(shouldPackagePluginPath("readme.txt")).toBe(true);
    expect(shouldPackagePluginPath("assets/icon.svg")).toBe(true);
    expect(shouldPackagePluginPath(".git/config")).toBe(false);
    expect(shouldPackagePluginPath("node_modules/leftpad/index.js")).toBe(false);
    expect(shouldPackagePluginPath(".env")).toBe(false);
    expect(shouldPackagePluginPath(".env.local")).toBe(false);
    expect(shouldPackagePluginPath("certs/portal.pem")).toBe(false);
    expect(shouldPackagePluginPath("id_rsa")).toBe(false);
    expect(shouldPackagePluginPath("../secrets.txt")).toBe(false);
  });

  it("packages the plugin with the WordPress folder layout and no secrets", () => {
    const source = wordpressPluginSourceDir();
    const zip = buildWordPressPluginZip(source);
    const entries = readZipEntries(zip);
    const names = entries.map((entry) => entry.name);

    expect(names).toContain(WORDPRESS_PLUGIN_BOOTSTRAP);
    expect(names).toContain("kt-portal-monitor/readme.txt");
    expect(names.every((name) => name.startsWith("kt-portal-monitor/"))).toBe(true);
    expect(names.some((name) => name.includes(".git") || name.includes("node_modules") || name.includes(".env"))).toBe(
      false,
    );

    const bootstrap = entries.find((entry) => entry.name === WORDPRESS_PLUGIN_BOOTSTRAP);
    expect(bootstrap?.data.toString("utf8")).toContain("Plugin Name: KT-Portal Monitor");
    const packed = Buffer.concat(entries.map((entry) => entry.data)).toString("utf8");
    for (const marker of SECRET_MARKERS) {
      expect(packed).not.toContain(marker);
    }

    const listed = pythonZipNames(zip);
    expect(listed).toEqual(names);
    expect(listed[0]).toBe("kt-portal-monitor/kt-portal-monitor.php");
  });

  it("omits secret files planted next to the plugin", () => {
    const root = mkdtempSync(path.join(tmpdir(), "kt-portal-plugin-"));
    try {
      mkdirSync(path.join(root, ".git"));
      mkdirSync(path.join(root, "node_modules", "pkg"), { recursive: true });
      writeFileSync(path.join(root, "kt-portal-monitor.php"), "<?php\n/* Plugin Name: KT-Portal Monitor */\n");
      writeFileSync(path.join(root, "readme.txt"), "KT-Portal Monitor\n");
      writeFileSync(path.join(root, ".env"), "SUPABASE_SERVICE_ROLE_KEY=secret\n");
      writeFileSync(path.join(root, ".git", "config"), "[core]\n");
      writeFileSync(path.join(root, "node_modules", "pkg", "index.js"), "module.exports = 1;\n");
      writeFileSync(path.join(root, "id_rsa"), "-----BEGIN PRIVATE KEY-----\n");
      writeFileSync(path.join(root, "assets.txt"), "ok\n");

      const names = readZipEntries(buildWordPressPluginZip(root)).map((entry) => entry.name);
      expect(names).toEqual([
        "kt-portal-monitor/assets.txt",
        "kt-portal-monitor/kt-portal-monitor.php",
        "kt-portal-monitor/readme.txt",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function pythonZipNames(zip: Buffer): string[] {
  const dir = mkdtempSync(path.join(tmpdir(), "kt-portal-zip-"));
  const zipPath = path.join(dir, "kt-portal-monitor.zip");
  try {
    writeFileSync(zipPath, zip);
    const output = execFileSync(
      "python3",
      [
        "-c",
        "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); bad=[n for n in z.namelist() if n.endswith('/')]; assert not bad, bad; print('\\n'.join(z.namelist()))",
        zipPath,
      ],
      { encoding: "utf8" },
    );
    return output.trim().split("\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
