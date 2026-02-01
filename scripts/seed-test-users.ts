/**
 * Seed test users for each role: super_admin, staff, partner, partner_staff, client.
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local or env.
 * Run: npm run seed
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config(); // .env fallback

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_PASSWORD = "TestPassword123!";

const TEST_USERS = [
  { email: "super-admin@test.example.com", role: "super_admin" as const, name: "Test Super Admin" },
  { email: "staff@test.example.com", role: "staff" as const, name: "Test Staff" },
  { email: "partner@test.example.com", role: "partner" as const, name: "Test Partner" },
  { email: "partner-staff@test.example.com", role: "partner_staff" as const, name: "Test Partner Staff" },
  { email: "client@test.example.com", role: "client" as const, name: "Test Client" },
];

async function main() {
  // 1. Ensure organizations exist: kre8ivtech (for super_admin, staff), partner (for partner, partner_staff), client (for client)
  const { data: existingOrgs } = await supabase.from("organizations").select("id, type, slug").in("slug", ["kre8ivtech", "test-partner", "test-client"]);

  let kre8ivtechId: string;
  let partnerOrgId: string;
  let clientOrgId: string;

  const kre8ivtech = existingOrgs?.find((o: { slug: string }) => o.slug === "kre8ivtech");
  const partnerOrg = existingOrgs?.find((o: { slug: string }) => o.slug === "test-partner");
  const clientOrg = existingOrgs?.find((o: { slug: string }) => o.slug === "test-client");

  if (kre8ivtech) {
    kre8ivtechId = kre8ivtech.id;
    console.log("Using existing kre8ivtech org:", kre8ivtechId);
  } else {
    const { data: inserted, error } = await supabase
      .from("organizations")
      .insert({ name: "Kre8ivTech", slug: "kre8ivtech", type: "kre8ivtech", status: "active" })
      .select("id")
      .single();
    if (error) {
      console.error("Failed to create kre8ivtech org:", error);
      process.exit(1);
    }
    kre8ivtechId = inserted.id;
    console.log("Created kre8ivtech org:", kre8ivtechId);
  }

  if (partnerOrg) {
    partnerOrgId = partnerOrg.id;
    console.log("Using existing test-partner org:", partnerOrgId);
  } else {
    const { data: inserted, error } = await supabase
      .from("organizations")
      .insert({ name: "Test Partner", slug: "test-partner", type: "partner", status: "active" })
      .select("id")
      .single();
    if (error) {
      console.error("Failed to create partner org:", error);
      process.exit(1);
    }
    partnerOrgId = inserted.id;
    console.log("Created test-partner org:", partnerOrgId);
  }

  if (clientOrg) {
    clientOrgId = clientOrg.id;
    console.log("Using existing test-client org:", clientOrgId);
  } else {
    const { data: inserted, error } = await supabase
      .from("organizations")
      .insert({
        name: "Test Client Org",
        slug: "test-client",
        type: "client",
        parent_org_id: partnerOrgId,
        status: "active",
      })
      .select("id")
      .single();
    if (error) {
      console.error("Failed to create client org:", error);
      process.exit(1);
    }
    clientOrgId = inserted.id;
    console.log("Created test-client org:", clientOrgId);
  }

  const orgByRole: Record<string, string> = {
    super_admin: kre8ivtechId,
    staff: kre8ivtechId,
    partner: partnerOrgId,
    partner_staff: partnerOrgId,
    client: clientOrgId,
  };

  for (const u of TEST_USERS) {
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users?.find((x) => x.email === u.email);

    let userId: string;

    if (found) {
      userId = found.id;
      console.log("User already exists:", u.email, userId);
    } else {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { name: u.name },
      });
      if (error) {
        console.error("Failed to create user", u.email, error);
        continue;
      }
      userId = created.user.id;
      console.log("Created user:", u.email, userId);
    }

    const orgId = orgByRole[u.role];
    const { error: updateError } = await (supabase as any)
      .from("profiles")
      .update({ role: u.role, organization_id: orgId, name: u.name })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to update profile for", u.email, updateError);
    } else {
      console.log("Updated profile:", u.email, "role=" + u.role, "org=" + orgId);
    }
  }

  console.log("\nDone. Test users (password: " + TEST_PASSWORD + "):");
  TEST_USERS.forEach((u) => console.log("  ", u.email, "->", u.role));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
