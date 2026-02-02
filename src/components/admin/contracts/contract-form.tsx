'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle, FileText, User, ChevronRight } from 'lucide-react'
import { createContractFromTemplate } from '@/lib/actions/contracts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface ContractFormProps {
  clients: { id: string; name: string }[]
  templates: any[]
}

export function ContractForm({ clients, templates }: ContractFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form State
  const [clientId, setClientId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [metadata, setMetadata] = useState<Record<string, string>>({})
  
  // Derived state
  const selectedTemplate = templates.find(t => t.id === templateId)
  const variables = selectedTemplate?.variables || []

  // Update metadata when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const initialMeta: Record<string, string> = {}
      selectedTemplate.variables?.forEach((v: any) => {
        initialMeta[v.name || v.key] = v.default || ''
      })
      setMetadata(initialMeta)
    }
  }, [selectedTemplate])

  const handleMetadataChange = (key: string, value: string) => {
    setMetadata(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !templateId) {
      setError('Please select both a client and a template.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await createContractFromTemplate(templateId, clientId, metadata)
      
      if (result.success && result.data) {
        router.push(`/dashboard/admin/contracts/${result.data.id}`)
      } else {
        setError(result.error || 'Failed to create contract')
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-20">
      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Client & Template Selection */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client" className="text-sm font-semibold text-slate-700">Client</Label>
            <Select onValueChange={setClientId} value={clientId}>
              <SelectTrigger id="client" className="h-11">
                <SelectValue placeholder="Select a client recipient" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template" className="text-sm font-semibold text-slate-700">Contract Template</Label>
            <Select onValueChange={setTemplateId} value={templateId}>
              <SelectTrigger id="template" className="h-11">
                <SelectValue placeholder="Choose a legal template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Variable Filling */}
      {selectedTemplate && (
        <Card className="border-slate-200 shadow-sm transition-all animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Template Variables
              </CardTitle>
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-bold uppercase">
                {selectedTemplate.contract_type}
              </Badge>
            </div>
            {selectedTemplate.description && (
              <p className="text-xs text-slate-500 mt-1">{selectedTemplate.description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            {variables.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {variables.map((variable: any) => (
                  <div key={variable.name || variable.key} className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                      {variable.label || variable.name || variable.key}
                      {variable.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      value={metadata[variable.name || variable.key] || ''}
                      onChange={(e) => handleMetadataChange(variable.name || variable.key, e.target.value)}
                      placeholder={`Enter ${variable.label || variable.name || variable.key.toLowerCase()}...`}
                      className="border-slate-200 focus:ring-primary h-10"
                      required={variable.required}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <p className="text-sm text-slate-500 italic">No variables defined in this template.</p>
              </div>
            )}
            
            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <Button 
                type="submit" 
                disabled={loading || !clientId || !templateId}
                className="bg-primary hover:bg-primary/90 px-8 h-11"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    Generate Contract Draft
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </form>
  )
}
