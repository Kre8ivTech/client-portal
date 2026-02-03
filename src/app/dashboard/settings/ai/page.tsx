'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Save } from 'lucide-react'
import { getAppSettings, updateAppSettings, type AppSettings } from '@/lib/actions/app-settings'
import { toast } from 'sonner'

export default function AISettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const data = await getAppSettings()
      setSettings(data)
    } catch (error) {
      console.error('Failed to load settings', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!settings) return

    setSaving(true)
    const formData = new FormData(e.currentTarget)
    
    const payload = {
      ai_provider_primary: formData.get('ai_provider_primary') as string,
      openrouter_api_key: formData.get('openrouter_api_key') as string || null,
      anthropic_api_key: formData.get('anthropic_api_key') as string || null,
      openai_api_key: formData.get('openai_api_key') as string || null,
    }

    try {
      const result = await updateAppSettings(payload as any)
      if (result.success) {
        toast.success('AI settings updated successfully')
        // Refresh local state to ensure consistency
        loadSettings()
      } else {
        toast.error(result.error || 'Failed to update settings')
      }
    } catch (error) {
      toast.error('An error occurred while saving')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Assistant Settings</h1>
        <p className="text-muted-foreground">
          Configure API keys for the AI Assistant. Keys are stored securely in the database.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Provider Configuration</CardTitle>
          <CardDescription>
            Choose your primary AI provider and configure API keys. The system will automatically fallback to other providers if the primary one fails.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="ai_provider_primary">Primary Provider</Label>
              <Select 
                name="ai_provider_primary" 
                defaultValue={settings?.ai_provider_primary || 'openrouter'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openrouter">OpenRouter (Recommended)</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The primary provider will be attempted first. Others will be used as backups.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-medium">API Keys</h3>
              
              <div className="space-y-2">
                <Label htmlFor="openrouter_api_key">OpenRouter API Key</Label>
                <Input 
                  id="openrouter_api_key" 
                  name="openrouter_api_key" 
                  type="password" 
                  defaultValue={settings?.openrouter_api_key || ''} 
                  placeholder="sk-or-..." 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="anthropic_api_key">Anthropic API Key</Label>
                <Input 
                  id="anthropic_api_key" 
                  name="anthropic_api_key" 
                  type="password" 
                  defaultValue={settings?.anthropic_api_key || ''} 
                  placeholder="sk-ant-..." 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="openai_api_key">OpenAI API Key</Label>
                <Input 
                  id="openai_api_key" 
                  name="openai_api_key" 
                  type="password" 
                  defaultValue={settings?.openai_api_key || ''} 
                  placeholder="sk-..." 
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
