import { inflateRawSync, deflateRawSync, crc32 } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { normalizeDashboardRole } from "@/lib/require-role";

export const WORDPRESS_PLUGIN_SLUG = "kt-portal-monitor";
export const WORDPRESS_PLUGIN_ZIP_NAME = "kt-portal-monitor.zip";
export const WORDPRESS_PLUGIN_BOOTSTRAP = `${WORDPRESS_PLUGIN_SLUG}/${WORDPRESS_PLUGIN_SLUG}.php`;

const DOWNLOAD_ROLES = new Set(["partner", "partner_staff", "staff", "super_admin"]);

const SECRET_FILE =
  /(?:^|\/)(?:\.env(?:\..*)?|.*\.(?:pem|key)|id_rsa|id_ed25519|credentials\.json|secrets?\.(?:json|txt|ya?ml))$/i;

export type WordpressPluginDownloadDecision = "allow" | "unauthorized" | "forbidden";

export function canDownloadWordPressPlugin(role: string | null | undefined): boolean {
  return typeof role === "string" && DOWNLOAD_ROLES.has(role);
}

/**
 * Signed-in partners and platform staff may download the plugin.
 * Missing or client roles are forbidden. Anonymous callers are unauthorized.
 * Legacy `admin` is treated as super_admin, matching the rest of the portal.
 */
export function wordpressPluginDownloadDecision(input: {
  userId: string | null;
  role: string | null | undefined;
}): WordpressPluginDownloadDecision {
  if (!input.userId) return "unauthorized";
  if (!canDownloadWordPressPlugin(normalizeDashboardRole(input.role))) return "forbidden";
  return "allow";
}

export function shouldPackagePluginPath(relativePosixPath: string): boolean {
  const normalized = relativePosixPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").includes("..")) return false;

  const parts = normalized.split("/");
  if (parts.some((part) => part === ".git" || part === "node_modules" || part.startsWith("."))) {
    return false;
  }

  return !SECRET_FILE.test(normalized);
}

export function wordpressPluginSourceDir(cwd = process.cwd()): string {
  return path.join(cwd, "wordpress", WORDPRESS_PLUGIN_SLUG);
}

type ZipEntry = {
  name: string;
  data: Buffer;
};

export function buildWordPressPluginZip(sourceDir: string): Buffer {
  const resolved = path.resolve(sourceDir);
  let sourceStat;
  try {
    sourceStat = statSync(resolved);
  } catch {
    throw new Error("WordPress plugin source directory is missing");
  }
  if (!sourceStat.isDirectory()) {
    throw new Error("WordPress plugin source directory is missing");
  }

  const files = collectPluginFiles(resolved);
  if (!files.some((file) => file.name === WORDPRESS_PLUGIN_BOOTSTRAP)) {
    throw new Error("WordPress plugin bootstrap file is missing");
  }

  return writeZip(files);
}

export function readZipEntries(zip: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(zip);
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid zip central directory");
    }
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");

    if (zip.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error("Invalid zip local header");
    }
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
    entries.push({ name, data });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function collectPluginFiles(root: string): ZipEntry[] {
  const files: ZipEntry[] = [];

  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (!shouldPackagePluginPath(relative)) continue;
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      files.push({
        name: `${WORDPRESS_PLUGIN_SLUG}/${relative}`,
        data: readFileSync(absolute),
      });
    }
  };

  walk(root);
  files.sort((left, right) => left.name.localeCompare(right.name));
  return files;
}

function writeZip(files: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  const stamp = dosDateTime(new Date(Date.UTC(2026, 0, 1)));

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const checksum = crc32(file.data) >>> 0;
    const compressed = deflateRawSync(file.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(stamp.time, 10);
    localHeader.writeUInt16LE(stamp.date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(file.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    const localRecord = Buffer.concat([localHeader, name, compressed]);
    locals.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(stamp.time, 12);
    centralHeader.writeUInt16LE(stamp.date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(file.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0x81a40000, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([centralHeader, name]));
    offset += localRecord.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralDirectory, end]);
}

function findEndOfCentralDirectory(zip: Buffer): number {
  const minimum = Math.max(0, zip.length - 22 - 0xffff);
  for (let offset = zip.length - 22; offset >= minimum; offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("Invalid zip archive");
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(date.getUTCFullYear(), 1980);
  return {
    time:
      ((date.getUTCHours() & 0x1f) << 11) |
      ((date.getUTCMinutes() & 0x3f) << 5) |
      (Math.floor(date.getUTCSeconds() / 2) & 0x1f),
    date: (((year - 1980) & 0x7f) << 9) | (((date.getUTCMonth() + 1) & 0x0f) << 5) | (date.getUTCDate() & 0x1f),
  };
}
