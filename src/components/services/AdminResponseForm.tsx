'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { AdminResponseInput } from '@/lib/validators/service'

interface AdminResponseFormProps {
  serviceRequestId: string
  isOpen: boolean
  onClose: () => void
  serviceRequestTitle?: string
}

export function AdminResponseForm({
  serviceRequestId,
  isOpen,
  onClose,
  serviceRequestTitle,
}: AdminResponseFormProps) {
  const [responseText, setResponseText] = useState('')
  const queryClient = useQueryClient()

  const respondMutation = useMutation({
    mutationFn: async (input: AdminResponseInput) => {
      const response = await fetch(`/api/service-requests/${serviceRequestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit response')
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success('Response submitted successfully', {
        description: 'The client has been notified of your response.',
      })
      queryClient.invalidateQueries({ queryKey: ['service-requests'] })
      queryClient.invalidateQueries({ queryKey: ['service-request', serviceRequestId] })
      setResponseText('')
      onClose()
    },
    onError: (error: Error) => {
      toast.error('Failed to submit response', {
        description: error.message,
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (responseText.trim().length < 20) {
      toast.error('Response too short', {
        description: 'Please provide at least 20 characters.',
      })
      return
    }

    respondMutation.mutate({
      response_text: responseText.trim(),
      response_metadata: {},
    })
  }

  const handleClose = () => {
    if (!respondMutation.isPending) {
      setResponseText('')
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Respond to Service Request</DialogTitle>
            <DialogDescription>
              {serviceRequestTitle
                ? `Provide details and next steps for: ${serviceRequestTitle}`
                : 'Provide details about how you will handle this service request.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="response_text">
                Response Details <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="response_text"
                placeholder="Provide a detailed response including:&#10;- Scope of work&#10;- Timeline estimate&#10;- Any questions or clarifications needed&#10;- Next steps"
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={10}
                className="resize-none"
                required
                minLength={20}
                maxLength={5000}
                disabled={respondMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                {responseText.length} / 5000 characters (minimum 20)
              </p>
            </div>

            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium mb-1">What happens next?</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>The client will be notified of your response</li>
                <li>They can approve and proceed with the service</li>
                <li>Or they can provide feedback for further discussion</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={respondMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={respondMutation.isPending || responseText.trim().length < 20}>
              {respondMutation.isPending ? 'Submitting...' : 'Submit Response'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
