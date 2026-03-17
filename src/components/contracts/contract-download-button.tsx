'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function ContractDownloadButton({ contractId }: { contractId: string }) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/contracts/${contractId}/download`, { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      } else {
        toast({ title: 'Error', description: 'Failed to generate download link', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to download contract', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleDownload} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Download Signed Copy
    </Button>
  )
}
