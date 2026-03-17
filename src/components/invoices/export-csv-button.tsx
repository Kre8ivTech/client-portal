'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function ExportCsvButton() {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: invoices, error } = await (supabase as any)
        .from('invoices')
        .select('invoice_number, status, total, amount_paid, balance_due, due_date, created_at, paid_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Build CSV
      const headers = ['Invoice #', 'Status', 'Total', 'Amount Paid', 'Balance Due', 'Due Date', 'Created', 'Paid Date']
      const rows = (invoices || []).map((inv: any) => [
        inv.invoice_number || '',
        inv.status || '',
        inv.total || 0,
        inv.amount_paid || 0,
        inv.balance_due || 0,
        inv.due_date || '',
        inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '',
        inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '',
      ])

      const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('CSV export failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download size={18} />}
      Export CSV
    </Button>
  )
}
