import { Badge } from "@/components/ui/badge";
import type { AiCapabilityAgent } from "@/lib/ai/capability-catalog";

export function AICapabilityAgents({
  agents,
  source,
}: {
  agents: AiCapabilityAgent[];
  source: "database" | "catalog";
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={source === "database" ? "default" : "secondary"}>
          {source === "database" ? "Saved" : "Catalog"}
        </Badge>
        <span>
          {agents.length} agents, {agents.reduce((sum, agent) => sum + agent.skills.length, 0)} skills,{" "}
          {agents.reduce((sum, agent) => sum + agent.tasks.length, 0)} tasks
        </span>
      </div>
      <div className="grid gap-4">
        {agents.map((agent) => (
          <article key={agent.slug} className="rounded-lg border p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{agent.name}</h3>
                <p className="text-sm text-muted-foreground">{agent.description}</p>
              </div>
              <code className="text-xs text-muted-foreground">{agent.href}</code>
            </div>
            <p className="text-sm">{agent.instruction}</p>
            <div className="flex flex-wrap gap-1">
              {agent.roles.map((role) => (
                <Badge key={role} variant="outline">
                  {role.replace("_", " ")}
                </Badge>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Skills</h4>
                <ul className="space-y-1 text-sm">
                  {agent.skills.map((skill) => (
                    <li key={skill.slug}>
                      <span className="font-medium">{skill.name}.</span> {skill.description}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Tasks</h4>
                <ul className="space-y-1 text-sm">
                  {agent.tasks.map((task) => (
                    <li key={task.slug}>{task.starterPrompt}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
