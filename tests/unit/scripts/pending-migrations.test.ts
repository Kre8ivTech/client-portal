import { describe, expect, it } from "vitest";
import { pendingMigrationFiles, type MigrationFile } from "../../../scripts/pending-migrations";

const files: MigrationFile[] = [
  { version: "20260202000010", name: "notifications_system", filename: "20260202000010_notifications_system.sql" },
  { version: "20260202000010", name: "staff_organization_access", filename: "20260202000010_staff_organization_access.sql" },
  { version: "20260930050000", name: "client_support_intake", filename: "20260930050000_client_support_intake.sql" },
];

describe("pendingMigrationFiles", () => {
  it("skips versions already recorded and duplicate timestamps", () => {
    expect(pendingMigrationFiles(files, ["20260202000010"]).map((file) => file.filename)).toEqual([
      "20260930050000_client_support_intake.sql",
    ]);
  });

  it("keeps the first file when a new version is duplicated", () => {
    expect(pendingMigrationFiles(files, []).map((file) => file.filename)).toEqual([
      "20260202000010_notifications_system.sql",
      "20260930050000_client_support_intake.sql",
    ]);
  });
});
