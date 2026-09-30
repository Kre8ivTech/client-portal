import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAPABILITY_AGENTS,
  buildCapabilityPrompt,
  capabilitiesForRole,
  suggestedTasksForRole,
} from "@/lib/ai/capability-catalog";
import { getHrefsForRole } from "@/lib/navigation/get-hrefs-for-role";
import type { DashboardRole } from "@/lib/require-role";

const ROLES: DashboardRole[] = ["client", "partner", "partner_staff", "staff", "super_admin"];

describe("capability agents", () => {
  it("gives every portal capability an agent, at least one skill, and at least one task", () => {
    const slugs = CAPABILITY_AGENTS.map((agent) => agent.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toEqual(
      expect.arrayContaining([
        "tickets",
        "messages",
        "projects",
        "contracts",
        "files",
        "knowledge-base",
        "invoices",
        "billing",
        "services",
        "vault",
        "profile",
        "notifications",
        "white-label",
        "google-ads",
        "partner-overview",
        "financials",
        "platform-integrations",
        "organization-integrations",
        "clients",
        "email-templates",
      ]),
    );

    for (const agent of CAPABILITY_AGENTS) {
      expect(agent.skills.length).toBeGreaterThan(0);
      expect(agent.tasks.length).toBeGreaterThan(0);
      expect(agent.href.startsWith("/dashboard")).toBe(true);
    }
  });

  it("only offers each agent to roles that can open its page", () => {
    for (const agent of CAPABILITY_AGENTS) {
      for (const role of agent.roles) {
        const accountManager =
          role === "staff" &&
          (agent.href === "/dashboard/settings/integrations" || agent.href === "/dashboard/invoices");
        expect(getHrefsForRole(role, accountManager)).toContain(agent.href);
      }
    }
  });

  it("hides partner, financial, and platform tools from clients", () => {
    const slugs = capabilitiesForRole("client").map((agent) => agent.slug);
    expect(slugs).toContain("tickets");
    expect(slugs).toContain("services");
    expect(slugs).not.toContain("white-label");
    expect(slugs).not.toContain("google-ads");
    expect(slugs).not.toContain("partner-overview");
    expect(slugs).not.toContain("financials");
    expect(slugs).not.toContain("platform-integrations");
    expect(slugs).not.toContain("clients");
  });

  it("includes white label for partners and keeps platform keys for super admins", () => {
    expect(capabilitiesForRole("partner").map((agent) => agent.slug)).toEqual(
      expect.arrayContaining(["white-label", "google-ads", "partner-overview", "clients"]),
    );
    expect(capabilitiesForRole("partner").map((agent) => agent.slug)).not.toContain("platform-integrations");
    expect(capabilitiesForRole("partner_staff").map((agent) => agent.slug)).not.toContain("white-label");
    const superAdminSlugs = capabilitiesForRole("super_admin").map((agent) => agent.slug);
    expect(superAdminSlugs).toContain("platform-integrations");
    expect(superAdminSlugs).toContain("white-label");
    expect(superAdminSlugs).not.toContain("google-ads");
    expect(superAdminSlugs).not.toContain("partner-overview");
  });

  it("builds a role-scoped prompt and starter tasks", () => {
    const clientPrompt = buildCapabilityPrompt("client");
    expect(clientPrompt).toContain("/dashboard/tickets");
    expect(clientPrompt).not.toContain("/dashboard/integrations");
    expect(clientPrompt).not.toContain("White label");

    const partnerPrompt = buildCapabilityPrompt("partner");
    expect(partnerPrompt).toContain("White label");
    expect(partnerPrompt).toContain("/dashboard/google-ads");

    for (const role of ROLES) {
      const tasks = suggestedTasksForRole(role);
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.length).toBeLessThanOrEqual(6);
    }
    expect(suggestedTasksForRole("partner").map((task) => task.agentName)).toContain("White label");
    expect(suggestedTasksForRole("client").map((task) => task.agentName)).not.toContain("White label");
    expect(suggestedTasksForRole("super_admin").map((task) => task.agentName)).toContain("Platform integrations");
  });

  it("seeds the same capability slugs in the database migration", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260930020000_ai_capability_agents.sql"),
      "utf8",
    );
    for (const agent of CAPABILITY_AGENTS) {
      expect(sql).toContain(`'${agent.slug}'`);
      for (const skill of agent.skills) {
        expect(sql).toContain(`'${skill.slug}'`);
      }
    }
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.ai_agents");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.ai_skills");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.ai_tasks");
  });
});
