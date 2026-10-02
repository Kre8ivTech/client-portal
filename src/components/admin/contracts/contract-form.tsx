'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, FileText, User, ChevronRight } from 'lucide-react'
import { submitNewContract } from '@/lib/actions/contracts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { DOCUSIGN_NOT_CONFIGURED_MESSAGE } from '@/lib/contracts/docusign-config'

interface ContractTemplateOption {
  id: string
  name: string
  description?: string | null
  contract_type?: string | null
  variables?: Array<{
    name?: string
    key?: string
    label?: string
    required?: boolean
    default?: string
  }>
}

function variableFieldKey(variable: { name?: string; key?: string }) {
  return variable.name || variable.key || 'field'
}

interface ContractFormProps {
  clients: { id: string; name: string; email: string }[]
  templates: ContractTemplateOption[]
  docusignConfigured: boolean
}

export function ContractForm({ clients, templates, docusignConfigured }: ContractFormProps) {
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
      selectedTemplate.variables?.forEach((v) => {
        initialMeta[variableFieldKey(v)] = v.default || ''
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
      const result = await submitNewContract(templateId, clientId, metadata)
      
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
      {!docusignConfigured && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertTitle>{DOCUSIGN_NOT_CONFIGURED_MESSAGE}</AlertTitle>
          <AlertDescription>
            This contract will not be sent. Add the DocuSign server credentials, then submit again.
            Status is shown under Admin, Integration Settings.
          </AlertDescription>
        </Alert>
      )}

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
            {clients.length === 0 && (
              <p className="text-sm text-amber-800">No client recipients are available.</p>
            )}
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
            {templates.length === 0 && (
              <p className="text-sm text-amber-800">
                No active templates yet.{' '}
                <Link href="/dashboard/admin/contracts/templates/new" className="underline font-medium">
                  Create a template
                </Link>
                .
              </p>
            )}
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
                {variables.map((variable) => {
                  const fieldKey = variableFieldKey(variable)
                  const fieldLabel = variable.label || fieldKey
                  return (
                  <div key={fieldKey} className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                      {fieldLabel}
                      {variable.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      value={metadata[fieldKey] || ''}
                      onChange={(e) => handleMetadataChange(fieldKey, e.target.value)}
                      placeholder={`Enter ${fieldLabel.toLowerCase()}...`}
                      className="border-slate-200 focus:ring-primary h-10"
                      required={variable.required}
                    />
                  </div>
                  )
                })}
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
                    Submit to DocuSign
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
