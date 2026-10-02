// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20261002010000_partners_create_client_organizations.sql",
);

const sql = readFileSync(migrationPath, "utf8");

function policyBody(): string {
  const match = sql.match(
    /CREATE POLICY "Partners can create client organizations"[\s\S]*?WITH CHECK \(([\s\S]*?)\);/,
  );
  if (!match) {
    throw new Error("Partner insert policy was not found");
  }
  return match[1];
}

describe("partners create client organizations policy", () => {
  it("drops and recreates only the partner insert policy", () => {
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Partners can create client organizations" ON public.organizations;',
    );
    expect(sql).toContain('FOR INSERT');
    expect(sql).toContain("TO authenticated");
    expect(sql).not.toMatch(/DROP POLICY(?! IF EXISTS "Partners can create client organizations")/);
  });

  it("allows only a child client organization under the caller's partner org", () => {
    const body = policyBody();
    expect(body).toContain("get_user_role() = 'partner'");
    expect(body).toContain("get_user_organization_type() = 'partner'");
    expect(body).toContain("get_user_organization_id() IS NOT NULL");
    expect(body).toContain("type = 'client'");
    expect(body).toContain("status = 'active'");
    expect(body).toContain("parent_org_id = get_user_organization_id()");
  });

  it("does not grant clients, partner staff, or arbitrary parent and domain writes", () => {
    const body = policyBody();
    expect(body).not.toMatch(/get_user_role\(\)\s*=\s*'client'/);
    expect(body).not.toContain("partner_staff");
    expect(body).not.toContain("'staff'");
    expect(body).not.toContain("super_admin");
    expect(body).toContain("custom_domain IS NULL");
    expect(body).toContain("COALESCE(custom_domain_verified, FALSE) = FALSE");
    expect(body).toContain("custom_domain_verified_at IS NULL");
    expect(body).toContain("stripe_customer_id IS NULL");
    expect(body).toContain("COALESCE(is_priority_client, FALSE) = FALSE");
  });
});
