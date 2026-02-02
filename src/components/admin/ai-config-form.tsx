'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateAIConfig } from '@/lib/actions/ai'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Save } from 'lucide-react'

interface AIConfigFormProps {
  configs: any[]
}

export function AIConfigForm({ configs }: AIConfigFormProps) {
  const [selectedRole, setSelectedRole] = useState('client')
  const [prompt, setPrompt] = useState(
    configs.find(c => c.role === 'client')?.system_prompt || ''
  )
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleRoleChange = (role: string) => {
    setSelectedRole(role)
    const config = configs.find(c => c.role === role)
    setPrompt(config?.system_prompt || '')
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const result = await updateAIConfig(selectedRole, prompt)
      if (result.success) {
        toast({ title: 'Success', description: 'AI Configuration updated' })
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update configuration', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Assistant Configuration</CardTitle>
        <CardDescription>
          Customize the system instructions for the AI Assistant based on user roles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>User Role</Label>
          <Select value={selectedRole} onValueChange={handleRoleChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>System Instructions (Prompt)</Label>
          <Textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={10}
            className="font-mono text-sm"
            placeholder="You are a helpful assistant..."
          />
          <p className="text-xs text-muted-foreground">
            These instructions define how the AI behaves and what information it prioritizes for this role.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
