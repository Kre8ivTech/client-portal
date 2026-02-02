'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Plus, Trash2, Calendar as CalendarIcon, Save } from 'lucide-react'
import { createInvoice } from '@/lib/actions/invoices'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface InvoiceFormProps {
  organizationId: string
  clients: { id: string; full_name: string; email: string }[]
}

type LineItem = {
  id: string
  description: string
  quantity: number
  unit_price: number // stored in dollars for input
}

export function InvoiceForm({ organizationId, clients }: InvoiceFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // Form State
  const [clientId, setClientId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 1000)}`)
  const [issueDate, setIssueDate] = useState<Date | undefined>(new Date())
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) // +30 days
  const [notes, setNotes] = useState('')
  
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unit_price: 0 }
  ])

  const addLineItem = () => {
    setLineItems([...lineItems, { id: Math.random().toString(), description: '', quantity: 1, unit_price: 0 }])
  }

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id))
    }
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !issueDate || !dueDate) return

    setLoading(true)
    
    const formattedLineItems = lineItems.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: Math.round(item.unit_price * 100), // convert to cents
      amount: Math.round(item.quantity * item.unit_price * 100) // convert to cents
    }))

    const result = await createInvoice({
      organization_id: organizationId,
      client_id: clientId,
      invoice_number: invoiceNumber,
      issue_date: format(issueDate, 'yyyy-MM-dd'),
      due_date: format(dueDate, 'yyyy-MM-dd'),
      notes,
      line_items: formattedLineItems
    })

    if (result.success) {
      router.push('/dashboard/admin/invoices')
    } else {
      // Handle error (show toast)
      console.error(result.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.full_name || client.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input 
                value={invoiceNumber} 
                onChange={e => setInvoiceNumber(e.target.value)} 
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input 
                  type="date"
                  value={issueDate ? format(issueDate, 'yyyy-MM-dd') : ''}
                  onChange={e => setIssueDate(e.target.value ? new Date(e.target.value) : undefined)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input 
                  type="date"
                  value={dueDate ? format(dueDate, 'yyyy-MM-dd') : ''}
                  onChange={e => setDueDate(e.target.value ? new Date(e.target.value) : undefined)}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              placeholder="Additional notes for the client..." 
              className="h-[200px]"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-12 gap-4 font-medium text-sm text-muted-foreground mb-2 px-2">
            <div className="col-span-6">Description</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right">Total</div>
          </div>
          
          {lineItems.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50 p-2 rounded-md group">
              <div className="col-span-6 flex gap-2">
                <Input 
                  placeholder="Item description" 
                  value={item.description}
                  onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                  required
                />
              </div>
              <div className="col-span-2">
                <Input 
                  type="number" 
                  min="1" 
                  step="0.01"
                  className="text-right"
                  value={item.quantity}
                  onChange={e => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="col-span-2">
                <Input 
                  type="number" 
                  min="0" 
                  step="0.01"
                  className="text-right"
                  value={item.unit_price}
                  onChange={e => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                <span className="font-medium">
                  ${(item.quantity * item.unit_price).toFixed(2)}
                </span>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeLineItem(item.id)}
                  disabled={lineItems.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-4 border-t">
            <div className="text-right space-y-1">
              <div className="text-sm text-muted-foreground">Total Amount</div>
              <div className="text-2xl font-bold">${calculateTotal().toFixed(2)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !clientId}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Create Invoice
        </Button>
      </div>
    </form>
  )
}
