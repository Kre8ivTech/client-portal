'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Loader2, AlertCircle, FileCode, Plus, Trash2, Variable, Eye, EyeOff, Sparkles, Send, Copy, Check, Bot, User, X, ChevronRight, ChevronLeft } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { extractTemplateVariables } from '@/lib/validators/contract-template'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

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

// Helper to extract text from UIMessage parts
function getUIMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ''
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

export function TemplateForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showAiAssistant, setShowAiAssistant] = useState(true)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [contractType, setContractType] = useState('')
  const [templateContent, setTemplateContent] = useState('')
  const [variables, setVariables] = useState<TemplateVariable[]>([])

  // AI Chat
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/ai/contracts/generate',
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          messages,
          contractType,
          templateName: name,
        },
      }),
    }),
  })

  const isStreaming = status === 'streaming' || status === 'submitted'

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isStreaming) return
    const message = chatInput
    setChatInput('')
    await sendMessage({ text: message })
  }

  const copyToContent = (text: string, messageId: string) => {
    if (templateContent) {
      setTemplateContent(templateContent + '\n\n' + text)
    } else {
      setTemplateContent(text)
    }
    setCopiedMessageId(messageId)
    setTimeout(() => setCopiedMessageId(null), 2000)
  }

  const replaceContent = (text: string) => {
    setTemplateContent(text)
  }

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

  // Quick prompts for common contract generation tasks
  const quickPrompts = [
    { label: 'Generate full template', prompt: `Generate a complete ${contractType || 'service agreement'} contract template with all standard sections.` },
    { label: 'Add payment terms', prompt: 'Add a comprehensive payment terms section with late fees and payment methods.' },
    { label: 'Add confidentiality clause', prompt: 'Generate a standard confidentiality/NDA clause.' },
    { label: 'Add termination clause', prompt: 'Add a termination clause with notice period and conditions.' },
    { label: 'Add liability clause', prompt: 'Generate a limitation of liability clause.' },
  ]

  return (
    <div className="flex gap-6">
      {/* Main Form */}
      <form onSubmit={handleSubmit} className={cn("space-y-6 pb-20 transition-all duration-300", showAiAssistant ? "flex-1" : "w-full")}>
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
      <div className="flex items-center justify-between gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAiAssistant(!showAiAssistant)}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          {showAiAssistant ? 'Hide' : 'Show'} AI Assistant
        </Button>
        <div className="flex items-center gap-4">
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
      </div>
      </form>

      {/* AI Assistant Panel */}
      {showAiAssistant && (
        <div className="w-[400px] shrink-0">
          <Card className="border-slate-200 shadow-sm sticky top-6 h-[calc(100vh-120px)] flex flex-col">
            <CardHeader className="pb-3 border-b shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">AI Contract Assistant</CardTitle>
                    <CardDescription className="text-xs">Generate contract content with AI</CardDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAiAssistant(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            {/* Quick Prompts */}
            <div className="p-3 border-b bg-slate-50/50 shrink-0">
              <p className="text-xs font-medium text-slate-500 mb-2">Quick actions:</p>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((qp, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={isStreaming}
                    onClick={() => {
                      setChatInput('')
                      sendMessage({ text: qp.prompt })
                    }}
                  >
                    {qp.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-3" ref={scrollAreaRef}>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <Bot className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Start a conversation</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Ask me to generate contract content, clauses, or help with legal language.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => {
                    const text = getUIMessageText(message)
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex gap-2",
                          message.role === 'user' ? "justify-end" : "justify-start"
                        )}
                      >
                        {message.role === 'assistant' && (
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                            <Bot className="h-3.5 w-3.5 text-primary" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                            message.role === 'user'
                              ? "bg-primary text-primary-foreground"
                              : "bg-slate-100 text-slate-800"
                          )}
                        >
                          <div className="whitespace-pre-wrap break-words">{text}</div>
                          {message.role === 'assistant' && text && (
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-200">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs gap-1 text-slate-500 hover:text-slate-700"
                                onClick={() => copyToContent(text, message.id)}
                              >
                                {copiedMessageId === message.id ? (
                                  <>
                                    <Check className="h-3 w-3" />
                                    Added
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-3 w-3" />
                                    Append
                                  </>
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs gap-1 text-slate-500 hover:text-slate-700"
                                onClick={() => replaceContent(text)}
                              >
                                <Copy className="h-3 w-3" />
                                Replace
                              </Button>
                            </div>
                          )}
                        </div>
                        {message.role === 'user' && (
                          <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-1">
                            <User className="h-3.5 w-3.5 text-slate-600" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {isStreaming && messages.length > 0 && !getUIMessageText(messages[messages.length - 1]) && (
                    <div className="flex gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="bg-slate-100 rounded-lg px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t shrink-0">
              <div className="flex gap-2">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask AI to generate content..."
                  className="min-h-[80px] resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-slate-400"
                  onClick={() => setMessages([])}
                  disabled={messages.length === 0 || isStreaming}
                >
                  Clear chat
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isStreaming}
                  className="gap-1"
                >
                  {isStreaming ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
