'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'

type DeleteInvoiceButtonProps = {
  invoiceId: string
  invoiceNumber: string
  status: string
}

export function DeleteInvoiceButton({
  invoiceId,
  invoiceNumber,
  status,
}: DeleteInvoiceButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPaid = status === 'paid' || status === 'partial'

  async function handleDelete() {
    setIsDeleting(true)
    setError(null)

    try {
      const endpoint = '/api/admin/invoices/' + encodeURIComponent(invoiceId)
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete invoice')
      }

      setOpen(false)
      toast({ title: `Invoice ${invoiceNumber} deleted` })
      router.refresh()
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'Failed to delete invoice'
      setError(message)
      toast({
        title: 'Invoice was not deleted',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (isPaid) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        title="Paid or partially paid invoices cannot be deleted"
      >
        <Trash2 aria-hidden="true" />
        Delete
      </Button>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete invoice {invoiceNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the invoice and its related line items and payment records.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
            onClick={(event) => {
              event.preventDefault()
              void handleDelete()
            }}
          >
            {isDeleting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Deleting...
              </>
            ) : (
              'Delete invoice'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
