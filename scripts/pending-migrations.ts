import { readdirSync } from "fs";
import { join } from "path";

export type MigrationFile = {
  version: string;
  name: string;
  filename: string;
};

export function listMigrationFiles(migrationsDir: string): MigrationFile[] {
  return readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith(".sql"))
    .sort()
    .map((filename) => {
      const splitAt = filename.indexOf("_");
      const version = splitAt === -1 ? filename.replace(/\.sql$/, "") : filename.slice(0, splitAt);
      const name = splitAt === -1 ? "" : filename.slice(splitAt + 1).replace(/\.sql$/, "");
      return { version, name, filename };
    });
}

export function pendingMigrationFiles(files: MigrationFile[], appliedVersions: Iterable<string>): MigrationFile[] {
  const applied = new Set(appliedVersions);
  const seen = new Set<string>();
  const pending: MigrationFile[] = [];

  for (const file of files) {
    if (applied.has(file.version) || seen.has(file.version)) continue;
    seen.add(file.version);
    pending.push(file);
  }

  return pending;
}
