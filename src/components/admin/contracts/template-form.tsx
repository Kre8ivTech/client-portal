'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Loader2, AlertCircle, FileCode, Plus, Trash2, Variable, Eye, EyeOff } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { extractTemplateVariables } from '@/lib/validators/contract-template'

interface TemplateVariable {
  name: string
  label?: string
  description?: string | null
  type: 'text' | 'number' | 'date' | 'email' | 'phone' | 'url'
  required: boolean
  default_value?: string | null
}

const contractTypes = [
  { value: 'service_agreement', label: 'Service Agreement' },
  { value: 'nda', label: 'NDA' },
  { value: 'msa', label: 'MSA' },
  { value: 'sow', label: 'Statement of Work' },
  { value: 'amendment', label: 'Amendment' },
  { value: 'other', label: 'Other' },
]

const variableTypes = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
]

export function TemplateForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [contractType, setContractType] = useState('')
  const [templateContent, setTemplateContent] = useState('')
  const [variables, setVariables] = useState<TemplateVariable[]>([])

  // Extract variables from content
  const detectedVariables = extractTemplateVariables(templateContent)
  const declaredVariableNames = variables.map(v => v.name)
  const undeclaredVariables = detectedVariables.filter(v => !declaredVariableNames.includes(v))

  const addVariable = (varName?: string) => {
    const newVar: TemplateVariable = {
      name: varName || '',
      label: varName ? varName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '',
      description: null,
      type: 'text',
      required: false,
      default_value: null,
    }
    setVariables([...variables, newVar])
  }

  const updateVariable = (index: number, updates: Partial<TemplateVariable>) => {
    const updated = [...variables]
    updated[index] = { ...updated[index], ...updates }
    setVariables(updated)
  }

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !description || !contractType || !templateContent) {
      setError('Please fill in all required fields.')
      return
    }

    // Validate variable names
    const invalidVars = variables.filter(v => !v.name || !/^[a-z][a-z0-9_]*$/.test(v.name))
    if (invalidVars.length > 0) {
      setError('Variable names must start with a letter and contain only lowercase letters, numbers, and underscores.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/contracts/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          contract_type: contractType,
          template_content: templateContent,
          variables,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create template')
      }

      router.push('/dashboard/admin/contracts/templates')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
      setLoading(false)
    }
  }

  // Generate preview with sample data
  const generatePreview = () => {
    let preview = templateContent
    variables.forEach(v => {
      const sampleValue = v.default_value || `[${v.label || v.name}]`
      preview = preview.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), sampleValue)
    })
    // Show undeclared variables as highlighted
    undeclaredVariables.forEach(v => {
      preview = preview.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), `⚠️{{${v}}}⚠️`)
    })
    return preview
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

      {/* Basic Information */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" />
            Template Information
          </CardTitle>
          <CardDescription>
            Define the basic details for your contract template.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                Template Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Standard Service Agreement"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="text-sm font-semibold text-slate-700">
                Contract Type <span className="text-red-500">*</span>
              </Label>
              <Select onValueChange={setContractType} value={contractType}>
                <SelectTrigger id="type" className="h-11">
                  <SelectValue placeholder="Select contract type" />
                </SelectTrigger>
                <SelectContent>
                  {contractTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-semibold text-slate-700">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe when this template should be used..."
              className="min-h-[80px] resize-none"
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Template Content */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Template Content</CardTitle>
              <CardDescription>
                Write your contract content. Use {'{{variable_name}}'} syntax for dynamic fields.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-2"
            >
              {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPreview ? 'Edit' : 'Preview'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showPreview ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 min-h-[300px] whitespace-pre-wrap font-mono text-sm">
              {generatePreview() || <span className="text-slate-400 italic">No content yet...</span>}
            </div>
          ) : (
            <Textarea
              value={templateContent}
              onChange={(e) => setTemplateContent(e.target.value)}
              placeholder={`Enter your contract template content here...

Example:
This Service Agreement ("Agreement") is entered into as of {{effective_date}} by and between:

**Service Provider:** {{provider_name}}
**Client:** {{client_name}}

1. SERVICES
The Service Provider agrees to provide the following services:
{{service_description}}

2. COMPENSATION
The Client agrees to pay {{payment_amount}} for the services described above.

...`}
              className="min-h-[300px] font-mono text-sm resize-y"
              required
            />
          )}

          {undeclaredVariables.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-800 mb-2">
                Detected undeclared variables:
              </p>
              <div className="flex flex-wrap gap-2">
                {undeclaredVariables.map(v => (
                  <Badge
                    key={v}
                    variant="outline"
                    className="bg-amber-100 border-amber-300 text-amber-800 cursor-pointer hover:bg-amber-200"
                    onClick={() => addVariable(v)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {v}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Variables */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Variable className="h-5 w-5 text-primary" />
                Template Variables
              </CardTitle>
              <CardDescription>
                Define the dynamic fields that will be filled when creating contracts.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addVariable()}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Variable
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {variables.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <Variable className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No variables defined yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Click "Add Variable" or use {'{{variable_name}}'} in your content to auto-detect.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {variables.map((variable, index) => (
                <div
                  key={index}
                  className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-500">Variable Name</Label>
                        <Input
                          value={variable.name}
                          onChange={(e) => updateVariable(index, { name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                          placeholder="e.g., client_name"
                          className="h-9 font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-500">Display Label</Label>
                        <Input
                          value={variable.label || ''}
                          onChange={(e) => updateVariable(index, { label: e.target.value })}
                          placeholder="e.g., Client Name"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-500">Type</Label>
                        <Select
                          value={variable.type}
                          onValueChange={(value: any) => updateVariable(index, { type: value })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {variableTypes.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariable(index)}
                      className="h-9 w-9 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-500">Default Value (optional)</Label>
                      <Input
                        value={variable.default_value || ''}
                        onChange={(e) => updateVariable(index, { default_value: e.target.value || null })}
                        placeholder="Default value if not provided"
                        className="h-9"
                      />
                    </div>
                    <div className="flex items-center gap-4 pt-5">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={variable.required}
                          onCheckedChange={(checked) => updateVariable(index, { required: checked })}
                        />
                        <Label className="text-sm text-slate-600">Required</Label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-end gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !name || !description || !contractType || !templateContent}
          className="bg-primary hover:bg-primary/90 px-8"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Template'
          )}
        </Button>
      </div>
    </form>
  )
}
