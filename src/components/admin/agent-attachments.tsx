"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  addAgentConnector,
  addAgentGuardrail,
  addAgentSkill,
  attachAgentGuardrail,
  removeAgentConnector,
  removeAgentGuardrail,
  removeAgentSkill,
} from "@/lib/actions/agent-attachments";

export type AgentSkillView = { id: string; name: string; description: string };
export type AgentConnectorView = { id: string; connectorId: string; name: string; description: string };
export type AgentGuardrailView = {
  id: string;
  guardrailId: string;
  name: string;
  instruction: string;
  severity: "block" | "warn";
};
export type AgentSetupView = {
  id: string;
  name: string;
  skills: AgentSkillView[];
  connectors: AgentConnectorView[];
  guardrails: AgentGuardrailView[];
};
export type CatalogConnector = { id: string; name: string; description: string };
export type CatalogGuardrail = { id: string; name: string; instruction: string; severity: "block" | "warn" };

const fieldClass = "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function AgentAttachments({
  agents,
  connectorCatalog,
  guardrailCatalog,
}: {
  agents: AgentSetupView[];
  connectorCatalog: CatalogConnector[];
  guardrailCatalog: CatalogGuardrail[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<"block" | "warn">("block");
  const agent = agents.find((item) => item.id === agentId) ?? null;
  const availableConnectors = connectorCatalog.filter(
    (connector) => !agent?.connectors.some((attached) => attached.connectorId === connector.id),
  );
  const availableGuardrails = guardrailCatalog.filter(
    (guardrail) => !agent?.guardrails.some((attached) => attached.guardrailId === guardrail.id),
  );

  function notice(result: { success: boolean; error?: string }, successText: string) {
    if (!result.success) {
      setError(result.error || "Something went wrong");
      setMessage(null);
      return false;
    }
    setError(null);
    setMessage(successText);
    router.refresh();
    return true;
  }

  function onAddSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentAgentId = agentId;
    startTransition(async () => {
      const result = await addAgentSkill({
        agentId: currentAgentId,
        name: String(form.get("name") || ""),
        description: String(form.get("description") || ""),
      });
      if (notice(result, "Skill added")) formElement.reset();
    });
  }

  function onAddConnector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const connectorId = String(new FormData(formElement).get("connectorId") || "");
    const currentAgentId = agentId;
    startTransition(async () => {
      const result = await addAgentConnector({ agentId: currentAgentId, connectorId });
      if (notice(result, "Connector added")) formElement.reset();
    });
  }

  function onAttachGuardrail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const guardrailId = String(new FormData(formElement).get("guardrailId") || "");
    const currentAgentId = agentId;
    startTransition(async () => {
      const result = await attachAgentGuardrail({ agentId: currentAgentId, guardrailId });
      if (notice(result, "Guardrail added")) formElement.reset();
    });
  }

  function onCreateGuardrail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentAgentId = agentId;
    const chosenSeverity = severity;
    startTransition(async () => {
      const result = await addAgentGuardrail({
        agentId: currentAgentId,
        name: String(form.get("name") || ""),
        instruction: String(form.get("instruction") || ""),
        severity: chosenSeverity,
      });
      if (notice(result, "Guardrail added")) {
        formElement.reset();
        setSeverity("block");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="min-h-6 text-sm">
        {error ? <p className="text-destructive">{error}</p> : null}
        {message ? <p>{message}</p> : null}
      </div>
      <div className="max-w-md space-y-1">
        <Label htmlFor="setup-agent">Agent</Label>
        <select
          id="setup-agent"
          className={fieldClass}
          value={agentId}
          onChange={(event) => {
            setAgentId(event.target.value);
            setError(null);
            setMessage(null);
          }}
        >
          {agents.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      {agent ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <section className="space-y-3 rounded-lg border p-4">
            <h3 className="font-semibold">Skills</h3>
            {agent.skills.length === 0 ? <p className="text-sm text-muted-foreground">No skills yet.</p> : null}
            <ul className="space-y-2">
              {agent.skills.map((skill) => (
                <li key={skill.id} className="space-y-2 rounded-md border p-3">
                  <p className="font-medium">{skill.name}</p>
                  <p className="text-sm text-muted-foreground">{skill.description}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    aria-label={`Remove skill ${skill.name}`}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await removeAgentSkill(skill.id);
                        notice(result, "Skill removed");
                      });
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <form onSubmit={onAddSkill} className="space-y-3">
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Add a skill</legend>
                <div className="space-y-1">
                  <Label htmlFor="skill-name">Skill name</Label>
                  <Input id="skill-name" name="name" required minLength={2} maxLength={80} autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="skill-description">Description</Label>
                  <Textarea id="skill-description" name="description" required minLength={3} maxLength={500} rows={3} />
                </div>
              </fieldset>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Add skill"}
              </Button>
            </form>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <h3 className="font-semibold">Connectors</h3>
            {agent.connectors.length === 0 ? <p className="text-sm text-muted-foreground">No connectors yet.</p> : null}
            <ul className="space-y-2">
              {agent.connectors.map((connector) => (
                <li key={connector.id} className="space-y-2 rounded-md border p-3">
                  <p className="font-medium">{connector.name}</p>
                  <p className="text-sm text-muted-foreground">{connector.description}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    aria-label={`Remove connector ${connector.name}`}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await removeAgentConnector(connector.id);
                        notice(result, "Connector removed");
                      });
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            {availableConnectors.length > 0 ? (
              <form onSubmit={onAddConnector} className="space-y-3">
                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">Add a connector</legend>
                  <div className="space-y-1">
                    <Label htmlFor="connector-id">Connector</Label>
                    <select id="connector-id" name="connectorId" className={fieldClass} required defaultValue="">
                      <option value="">Choose a connector</option>
                      {availableConnectors.map((connector) => (
                        <option key={connector.id} value={connector.id}>
                          {connector.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </fieldset>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving..." : "Add connector"}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">Every connector is already on this agent.</p>
            )}
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <h3 className="font-semibold">Guardrails</h3>
            {agent.guardrails.length === 0 ? <p className="text-sm text-muted-foreground">No guardrails yet.</p> : null}
            <ul className="space-y-2">
              {agent.guardrails.map((guardrail) => (
                <li key={guardrail.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{guardrail.name}</p>
                    <Badge variant="outline">{guardrail.severity}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{guardrail.instruction}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    aria-label={`Remove guardrail ${guardrail.name}`}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await removeAgentGuardrail(guardrail.id);
                        notice(result, "Guardrail removed");
                      });
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            {availableGuardrails.length > 0 ? (
              <form onSubmit={onAttachGuardrail} className="space-y-3">
                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">Add a library guardrail</legend>
                  <div className="space-y-1">
                    <Label htmlFor="guardrail-id">Guardrail</Label>
                    <select id="guardrail-id" name="guardrailId" className={fieldClass} required defaultValue="">
                      <option value="">Choose a guardrail</option>
                      {availableGuardrails.map((guardrail) => (
                        <option key={guardrail.id} value={guardrail.id}>
                          {guardrail.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </fieldset>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving..." : "Add guardrail"}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">Every library guardrail is already on this agent.</p>
            )}
            <form onSubmit={onCreateGuardrail} className="space-y-3 border-t pt-3">
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Create a guardrail</legend>
                <div className="space-y-1">
                  <Label htmlFor="guardrail-name">Name</Label>
                  <Input id="guardrail-name" name="name" required minLength={2} maxLength={80} autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="guardrail-instruction">Instruction</Label>
                  <Textarea id="guardrail-instruction" name="instruction" required minLength={8} maxLength={500} rows={3} />
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Severity</legend>
                  {(["block", "warn"] as const).map((value) => (
                    <label key={value} className="mr-4 inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="severity"
                        value={value}
                        checked={severity === value}
                        onChange={() => setSeverity(value)}
                      />
                      {value}
                    </label>
                  ))}
                </fieldset>
              </fieldset>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Create guardrail"}
              </Button>
            </form>
          </section>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No agents are available.</p>
      )}
    </div>
  );
}
