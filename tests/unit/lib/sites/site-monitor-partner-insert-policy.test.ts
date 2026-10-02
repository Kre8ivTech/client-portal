// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20261002180000_partner_insert_site_monitors.sql",
);

const sql = readFileSync(migrationPath, "utf8");

function policyBody(): string {
  const match = sql.match(
    /CREATE POLICY "Partners insert child client site_monitors"[\s\S]*?WITH CHECK \(([\s\S]*?)\);/,
  );
  if (!match) {
    throw new Error("Partner site monitor insert policy was not found");
  }
  return match[1];
}

describe("partner site monitor insert policy", () => {
  it("recreates only the partner insert policy", () => {
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Partners insert child client site_monitors" ON public.site_monitors;',
    );
    expect(sql).toContain("FOR INSERT");
    expect(sql).toContain("TO authenticated");
    expect(sql).not.toMatch(/FOR ALL/);
    expect(sql).not.toMatch(/FOR UPDATE/);
    expect(sql).not.toMatch(/FOR DELETE/);
  });

  it("allows partner and partner_staff inserts only for a child client org", () => {
    const body = policyBody();
    expect(body).toContain("public.get_user_role() IN ('partner', 'partner_staff')");
    expect(body).toContain("public.get_user_organization_type() = 'partner'");
    expect(body).toContain("public.get_user_organization_id() IS NOT NULL");
    expect(body).toContain("client_org.parent_org_id = public.get_user_organization_id()");
    expect(body).toContain("client_org.type = 'client'");
  });

  it("does not grant the insert to clients or platform staff", () => {
    const body = policyBody();
    expect(body).toContain("public.get_user_role() IN ('partner', 'partner_staff')");
    expect(body).not.toMatch(/get_user_role\(\) IN \([^)]*'client'/);
    expect(body).not.toMatch(/get_user_role\(\) IN \([^)]*'staff'/);
    expect(body).not.toContain("super_admin");
    expect(body).toContain("client_org.type = 'client'");
  });
});
