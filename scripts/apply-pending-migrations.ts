import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";
import { normalizeSupabaseSslConnection } from "./lib/postgres-connection";
import { isExistingSchemaError, listMigrationFiles, pendingMigrationFiles } from "./pending-migrations";

function getConnectionString(): string {
  const configuredUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL;

  if (configuredUrl) return normalizeSupabaseSslConnection(configuredUrl);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef =
    process.env.SUPABASE_PROJECT_REF || supabaseUrl?.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;

  if (!projectRef || !password) {
    throw new Error("A direct Postgres URL or Supabase project reference and database password are required");
  }

  return normalizeSupabaseSslConnection(
    `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`,
  );
}

export async function applyPendingMigrations(): Promise<string[]> {
  const client = new Client({
    connectionString: getConnectionString(),
    connectionTimeoutMillis: 15_000,
  });
  await client.connect();

  try {
    const applied = await client.query<{ version: string }>(
      "SELECT version FROM supabase_migrations.schema_migrations",
    );
    const files = listMigrationFiles(join(process.cwd(), "supabase", "migrations"));
    const pending = pendingMigrationFiles(
      files,
      applied.rows.map((row) => row.version),
    );

    for (const migration of pending) {
      const sql = readFileSync(join(process.cwd(), "supabase", "migrations", migration.filename), "utf8");
      await client.query("BEGIN");
      try {
        await client.query("SELECT pg_advisory_xact_lock(hashtext('client-portal-pending-migrations'))");
        await client.query(sql);
        await client.query(
          "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2)",
          [migration.version, migration.name],
        );
        await client.query("COMMIT");
        console.log(`Applied migration ${migration.filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        if (!isExistingSchemaError(error)) throw error;

        await client.query(
          "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING",
          [migration.version, migration.name],
        );
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Recorded existing migration ${migration.filename}: ${message}`);
      }
    }

    return pending.map((migration) => migration.filename);
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("apply-pending-migrations.ts")) {
  applyPendingMigrations()
    .then((applied) => {
      console.log(applied.length ? `Applied ${applied.length} migration(s)` : "No pending migrations");
    })
    .catch((error: Error) => {
      console.error(error.message);
      process.exit(1);
    });
}
