import { describe, expect, it } from "vitest";
import { formatAgentContexts, formatAttachmentSummary, toAgentContexts } from "@/lib/ai/format-agent-context";

describe("formatAgentContexts", () => {
  it("includes skills, connectors, and guardrails for each agent", () => {
    const prompt = formatAgentContexts([
      {
        name: "Tickets",
        href: "/dashboard/tickets",
        instruction: "Help with tickets.",
        skills: ["Open a ticket"],
        connectors: [{ name: "Tickets" }, { name: "Email" }],
        guardrails: [{ name: "Do not collect secrets", instruction: "Never ask for a password." }],
        tasks: ["How do I submit a support ticket?"],
      },
    ]);

    expect(prompt).toContain("Skills: Open a ticket");
    expect(prompt).toContain("Connectors: Tickets, Email");
    expect(prompt).toContain("Guardrails: Do not collect secrets: Never ask for a password.");
    expect(prompt).not.toContain("Google Ads");
  });

  it("drops disabled attachments and keeps enabled connector rows", () => {
    const [agent] = toAgentContexts([
      {
        name: "Tickets",
        href: "/dashboard/tickets",
        instruction: "Help with tickets.",
        ai_skills: [
          { name: "Open a ticket", is_active: true, display_order: 2 },
          { name: "Retired skill", is_active: false, display_order: 1 },
        ],
        ai_tasks: [{ starter_prompt: "How do I submit a support ticket?", display_order: 1 }],
        ai_agent_connectors: [
          { is_enabled: false, ai_connectors: { name: "Stripe" } },
          { is_enabled: true, ai_connectors: [{ name: "Tickets" }] },
        ],
        ai_agent_guardrails: [
          { is_enabled: true, ai_guardrails: { name: "Do not collect secrets", instruction: "Never ask for a password." } },
        ],
      },
    ]);

    expect(agent.skills).toEqual(["Open a ticket"]);
    expect(agent.connectors.map((connector) => connector.name)).toEqual(["Tickets"]);
    expect(formatAttachmentSummary({
      skills: agent.skills,
      connectors: agent.connectors.map((connector) => connector.name),
      guardrails: agent.guardrails.map((guardrail) => `${guardrail.name}: ${guardrail.instruction}`),
    })).toContain("Guardrails: Do not collect secrets: Never ask for a password.");
  });
});
