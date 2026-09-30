import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AIConfigForm } from '@/components/admin/ai-config-form'
import { AICapabilityAgents } from '@/components/admin/ai-capability-agents'
import { AIDocumentsManager } from '@/components/admin/ai-documents-manager'
import { AIRulesManager } from '@/components/admin/ai-rules-manager'
import { CAPABILITY_AGENTS, type AiCapabilityAgent, type AiRole } from '@/lib/ai/capability-catalog'
import { requireRole } from '@/lib/require-role'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Bot, FileText, Shield, MessageSquare, Sparkles } from 'lucide-react'

const AI_ROLE_SET = new Set<AiRole>(['super_admin', 'staff', 'partner', 'partner_staff', 'client'])

function agentsFromRows(rows: any[] | null): AiCapabilityAgent[] | null {
  if (!rows?.length) return null
  return [...rows]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((row) => ({
      slug: row.capability_slug,
      name: row.name,
      description: row.description,
      instruction: row.instruction,
      href: row.href,
      roles: (row.roles ?? []).filter((role: string) => AI_ROLE_SET.has(role as AiRole)),
      skills: [...(row.ai_skills ?? [])]
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((skill) => ({ slug: skill.slug, name: skill.name, description: skill.description })),
      tasks: [...(row.ai_tasks ?? [])]
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((task) => ({ slug: task.slug, name: task.name, starterPrompt: task.starter_prompt })),
    }))
}

export default async function AIAdminPage() {
  await requireRole(['super_admin', 'staff'])

  const supabase = await createServerSupabaseClient()

  const [
    { data: configs },
    { data: documents },
    { data: rules },
    { data: organizations },
    agentResult,
  ] = await Promise.all([
    supabase.from('ai_configs').select('*').is('organization_id', null),
    supabase.from('ai_documents').select('*').order('created_at', { ascending: false }),
    supabase.from('ai_rules').select('*').order('priority', { ascending: false }),
    supabase.from('organizations').select('id, name, slug'),
    supabase
      .from('ai_agents')
      .select('capability_slug, name, description, instruction, href, roles, display_order, ai_skills(slug, name, description, display_order), ai_tasks(slug, name, starter_prompt, display_order)')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
  ])

  const savedAgents = agentResult.error ? null : agentsFromRows(agentResult.data)
  const capabilityAgents = savedAgents ?? CAPABILITY_AGENTS

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-200">
          <Bot className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Assistant Settings</h2>
          <p className="text-muted-foreground mt-1">
            Configure capability agents, skills, tasks, prompts, knowledge, and rules.{" "}
            <Link href="/dashboard/admin/agents" className="underline">Build workflows, assignments, and schedules</Link>
          </p>
        </div>
      </div>

      <Tabs defaultValue="agents" className="space-y-6">
        <TabsList className="flex h-auto w-full max-w-4xl flex-wrap justify-start gap-1">
          <TabsTrigger value="agents" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Prompts
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <Shield className="h-4 w-4" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="organizations" className="gap-2">
            <Bot className="h-4 w-4" />
            Organizations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Capability agents</CardTitle>
              <CardDescription>
                One agent for each portal capability, with the skills it can explain and the tasks it offers in chat.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AICapabilityAgents
                agents={capabilityAgents}
                source={savedAgents ? 'database' : 'catalog'}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Prompts</CardTitle>
              <CardDescription>
                Define the AI assistant&apos;s personality, behavior, and base instructions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIConfigForm configs={configs || []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base Documents</CardTitle>
              <CardDescription>
                Upload documentation, FAQs, policies, and custom content for the AI to reference
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIDocumentsManager
                documents={documents || []}
                organizations={organizations || []}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Rules & Guidelines</CardTitle>
              <CardDescription>
                Set specific rules and constraints for AI responses per organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIRulesManager
                rules={rules || []}
                organizations={organizations || []}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organizations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization AI Configuration</CardTitle>
              <CardDescription>
                View and manage AI settings for each organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {organizations && organizations.length > 0 ? (
                  <div className="grid gap-4">
                    {organizations.map((org: any) => {
                      const orgDocs = documents?.filter((d: any) => d.organization_id === org.id) || []
                      const orgRules = rules?.filter((r: any) => r.organization_id === org.id) || []

                      return (
                        <div key={org.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{org.name}</h4>
                              <p className="text-sm text-muted-foreground">/{org.slug}</p>
                            </div>
                            <div className="flex gap-4 text-sm">
                              <div className="text-center">
                                <p className="font-medium">{orgDocs.length}</p>
                                <p className="text-muted-foreground">Documents</p>
                              </div>
                              <div className="text-center">
                                <p className="font-medium">{orgRules.length}</p>
                                <p className="text-muted-foreground">Rules</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No organizations found
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
