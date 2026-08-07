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

type DeleteTicketButtonProps = {
  ticketId: string
  ticketNumber: number
  subject: string
  onDeleted?: () => void | Promise<void>
}

export function DeleteTicketButton({
  ticketId,
  ticketNumber,
  subject,
  onDeleted,
}: DeleteTicketButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setIsDeleting(true)
    setError(null)

    try {
      const endpoint = '/api/admin/tickets/' + encodeURIComponent(ticketId)
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete ticket')
      }

      setOpen(false)
      toast({ title: ['Ticket', '#' + ticketNumber, 'deleted'].join(' ') })
      await onDeleted?.()
      router.refresh()
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'Failed to delete ticket'
      setError(message)
      toast({
        title: 'Ticket was not deleted',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={(event) => event.stopPropagation()}
        >
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete ticket #{ticketNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes “{subject}” and its comments, attachment links,
            notifications, and deliverables. This action cannot be undone.
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
              'Delete ticket'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
