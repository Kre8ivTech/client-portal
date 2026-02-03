'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Receipt,
  Plus,
  ExternalLink,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Invoice = {
  id: string
  invoice_number: string
  status: string
  issue_date: string
  due_date: string
  total: number
  balance_due: number
  organization: { id: string; name: string } | null
}

type UnbilledSummary = {
  hours: number
  amount: number
  entries: number
}

interface ProjectInvoicesProps {
  projectId: string
  canCreateInvoice: boolean
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-green-100 text-green-700">Paid</Badge>
    case 'sent':
    case 'pending':
      return <Badge className="bg-blue-100 text-blue-700">Pending</Badge>
    case 'overdue':
      return <Badge className="bg-red-100 text-red-700">Overdue</Badge>
    case 'draft':
      return <Badge variant="outline">Draft</Badge>
    case 'partial':
      return <Badge className="bg-yellow-100 text-yellow-700">Partial</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function ProjectInvoices({ projectId, canCreateInvoice }: ProjectInvoicesProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [unbilled, setUnbilled] = useState<UnbilledSummary>({ hours: 0, amount: 0, entries: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchInvoices()
    fetchUnbilledTime()
  }, [projectId])

  async function fetchInvoices() {
    setIsLoading(true)
    try {
      // Fetch invoices linked to this project
      const response = await fetch(`/api/invoices?project_id=${projectId}`)
      if (!response.ok) throw new Error('Failed to fetch invoices')
      const { data } = await response.json()
      setInvoices(data ?? [])
    } catch (error) {
      console.error('Failed to fetch invoices:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchUnbilledTime() {
    try {
      const response = await fetch(`/api/projects/${projectId}/time-entries?billable=true&billed=false`)
      if (!response.ok) throw new Error('Failed to fetch unbilled time')
      const { data, summary } = await response.json()

      // Calculate unbilled amount
      const unbilledAmount = (data ?? [])
        .filter((e: any) => e.billable && !e.billed && e.hourly_rate)
        .reduce((sum: number, e: any) => sum + e.hours * (e.hourly_rate / 100), 0)

      setUnbilled({
        hours: summary?.unbilledHours ?? 0,
        amount: unbilledAmount,
        entries: (data ?? []).length,
      })
    } catch (error) {
      console.error('Failed to fetch unbilled time:', error)
    }
  }

  // Calculate totals
  const totalBilled = invoices.reduce((sum, inv) => sum + inv.total, 0) / 100
  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance_due, 0) / 100
  const totalPaid = totalBilled - totalOutstanding

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Project Invoices
            </CardTitle>
            <CardDescription>
              Invoices and billing for this project
            </CardDescription>
          </div>
          {canCreateInvoice && unbilled.hours > 0 && (
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Total Billed
            </div>
            <p className="text-2xl font-bold">${totalBilled.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
              <CheckCircle2 className="h-4 w-4" />
              Paid
            </div>
            <p className="text-2xl font-bold text-green-700">${totalPaid.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
              <AlertCircle className="h-4 w-4" />
              Outstanding
            </div>
            <p className="text-2xl font-bold text-blue-700">${totalOutstanding.toLocaleString()}</p>
          </div>
          <div className={cn(
            'p-4 rounded-lg',
            unbilled.hours > 0 ? 'bg-orange-50' : 'bg-slate-50'
          )}>
            <div className={cn(
              'flex items-center gap-2 text-sm mb-1',
              unbilled.hours > 0 ? 'text-orange-600' : 'text-slate-500'
            )}>
              <Clock className="h-4 w-4" />
              Unbilled Time
            </div>
            <p className={cn(
              'text-2xl font-bold',
              unbilled.hours > 0 ? 'text-orange-700' : 'text-slate-700'
            )}>
              {unbilled.hours.toFixed(1)}h
            </p>
            {unbilled.amount > 0 && (
              <p className="text-sm text-orange-600">${unbilled.amount.toLocaleString()}</p>
            )}
          </div>
        </div>

        {/* Invoices table */}
        {invoices.length === 0 ? (
          <div className="text-center py-12 border rounded-lg border-dashed">
            <Receipt className="h-10 w-10 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No invoices yet</h3>
            <p className="text-slate-500 text-sm">
              {canCreateInvoice
                ? 'Create an invoice from unbilled time entries.'
                : 'No invoices have been created for this project yet.'}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const isOverdue =
                    invoice.status !== 'paid' &&
                    new Date(invoice.due_date) < new Date()

                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        {invoice.organization?.name ?? 'N/A'}
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.issue_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className={cn(isOverdue && 'text-red-600')}>
                        {new Date(invoice.due_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${(invoice.total / 100).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.balance_due > 0 ? (
                          <span className="font-medium text-orange-600">
                            ${(invoice.balance_due / 100).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-green-600">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(isOverdue ? 'overdue' : invoice.status)}
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/invoices/${invoice.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
