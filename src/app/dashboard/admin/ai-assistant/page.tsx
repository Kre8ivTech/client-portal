import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AIConfigForm } from '@/components/admin/ai-config-form'
import { AIDocumentsManager } from '@/components/admin/ai-documents-manager'
import { AIRulesManager } from '@/components/admin/ai-rules-manager'
import { requireRole } from '@/lib/require-role'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bot, FileText, Shield, MessageSquare } from 'lucide-react'

export default async function AIAdminPage() {
  await requireRole(['super_admin', 'staff'])

  const supabase = await createServerSupabaseClient()

  const [
    { data: configs },
    { data: documents },
    { data: rules },
    { data: organizations }
  ] = await Promise.all([
    supabase.from('ai_configs').select('*').is('organization_id', null),
    supabase.from('ai_documents').select('*').order('created_at', { ascending: false }),
    supabase.from('ai_rules').select('*').order('priority', { ascending: false }),
    supabase.from('organizations').select('id, name, slug')
  ])

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-200">
          <Bot className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Assistant Settings</h2>
          <p className="text-muted-foreground mt-1">
            Configure AI behavior, knowledge base, and rules for organization-specific chatbots
          </p>
        </div>
      </div>

      <Tabs defaultValue="prompts" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
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
                    {organizations.map((org) => {
                      const orgDocs = documents?.filter(d => d.organization_id === org.id) || []
                      const orgRules = rules?.filter(r => r.organization_id === org.id) || []

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
