'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Edit, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface AIRule {
  id: string
  organization_id: string | null
  rule_name: string
  rule_content: string
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Organization {
  id: string
  name: string
  slug: string
}

interface AIRulesManagerProps {
  rules: AIRule[]
  organizations: Organization[]
}

export function AIRulesManager({ rules: initialRules, organizations }: AIRulesManagerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [rules, setRules] = useState(initialRules)
  const [isOpen, setIsOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AIRule | null>(null)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    rule_name: '',
    rule_content: '',
    priority: 0,
    is_active: true,
    organization_id: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = {
        rule_name: formData.rule_name,
        rule_content: formData.rule_content,
        priority: formData.priority,
        is_active: formData.is_active,
        organization_id: formData.organization_id || null,
        updated_at: new Date().toISOString()
      }

      if (editingRule) {
        const { error } = await supabase
          .from('ai_rules')
          .update(data)
          .eq('id', editingRule.id)

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Rule updated successfully'
        })
      } else {
        const { error } = await supabase
          .from('ai_rules')
          .insert(data)

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Rule created successfully'
        })
      }

      setIsOpen(false)
      resetForm()
      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save rule',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return

    try {
      const { error } = await supabase
        .from('ai_rules')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Rule deleted successfully'
      })

      setRules(rules.filter(r => r.id !== id))
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete rule',
        variant: 'destructive'
      })
    }
  }

  const handleToggleActive = async (rule: AIRule) => {
    try {
      const { error } = await supabase
        .from('ai_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id)

      if (error) throw error

      setRules(rules.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))

      toast({
        title: 'Success',
        description: `Rule ${!rule.is_active ? 'enabled' : 'disabled'}`
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update rule',
        variant: 'destructive'
      })
    }
  }

  const handleEdit = (rule: AIRule) => {
    setEditingRule(rule)
    setFormData({
      rule_name: rule.rule_name,
      rule_content: rule.rule_content,
      priority: rule.priority,
      is_active: rule.is_active,
      organization_id: rule.organization_id || ''
    })
    setIsOpen(true)
  }

  const resetForm = () => {
    setFormData({
      rule_name: '',
      rule_content: '',
      priority: 0,
      is_active: true,
      organization_id: ''
    })
    setEditingRule(null)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      resetForm()
    }
  }

  return (
    <div className="space-y-4">
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Add New Rule'}</DialogTitle>
            <DialogDescription>
              Define rules and constraints for AI responses
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rule_name">Rule Name *</Label>
              <Input
                id="rule_name"
                value={formData.rule_name}
                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                placeholder="e.g. No pricing disclosure, Response tone"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  placeholder="0"
                  min="0"
                />
                <p className="text-xs text-muted-foreground">
                  Higher numbers = higher priority
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="organization_id">Organization</Label>
                <Select
                  value={formData.organization_id}
                  onValueChange={(value) => setFormData({ ...formData, organization_id: value })}
                >
                  <SelectTrigger id="organization_id">
                    <SelectValue placeholder="Global (all orgs)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Global (all organizations)</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule_content">Rule Content *</Label>
              <Textarea
                id="rule_content"
                value={formData.rule_content}
                onChange={(e) => setFormData({ ...formData, rule_content: e.target.value })}
                placeholder="Describe the rule or constraint for the AI..."
                rows={6}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : editingRule ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {rules.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No rules yet</p>
          <p className="text-sm text-muted-foreground">
            Add rules to constrain AI behavior
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead className="w-[100px]">Priority</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => {
                const org = organizations.find(o => o.id === rule.organization_id)
                return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{rule.rule_name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {rule.rule_content}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {org ? org.name : <span className="text-muted-foreground">Global</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{rule.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => handleToggleActive(rule)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(rule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
