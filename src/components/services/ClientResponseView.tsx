'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { ClientFeedbackInput } from '@/lib/validators/service'

interface ClientResponseViewProps {
  serviceRequestId: string
  adminResponse: {
    response_text: string
    created_at: string
    responder: {
      name: string | null
      email: string
    }
  }
}

export function ClientResponseView({ serviceRequestId, adminResponse }: ClientResponseViewProps) {
  const [feedbackText, setFeedbackText] = useState('')
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const queryClient = useQueryClient()

  const feedbackMutation = useMutation({
    mutationFn: async (input: ClientFeedbackInput) => {
      const response = await fetch(`/api/service-requests/${serviceRequestId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit feedback')
      }

      return response.json()
    },
    onSuccess: (data, variables) => {
      const message = variables.is_approval
        ? 'Service request approved'
        : 'Feedback submitted successfully'
      const description = variables.is_approval
        ? 'The team will begin work on your service request.'
        : 'The team has been notified of your feedback.'

      toast.success(message, { description })
      queryClient.invalidateQueries({ queryKey: ['service-requests'] })
      queryClient.invalidateQueries({ queryKey: ['service-request', serviceRequestId] })
      setFeedbackText('')
      setShowFeedbackForm(false)
    },
    onError: (error: Error) => {
      toast.error('Failed to submit response', {
        description: error.message,
      })
    },
  })

  const handleApprove = () => {
    feedbackMutation.mutate({
      response_text: 'Approved. Please proceed with the service.',
      is_approval: true,
    })
  }

  const handleProvideFeedback = (e: React.FormEvent) => {
    e.preventDefault()

    if (feedbackText.trim().length < 10) {
      toast.error('Feedback too short', {
        description: 'Please provide at least 10 characters.',
      })
      return
    }

    feedbackMutation.mutate({
      response_text: feedbackText.trim(),
      is_approval: false,
    })
  }

  const formattedDate = new Date(adminResponse.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Response from {adminResponse.responder.name || 'Team'}</CardTitle>
        <CardDescription>{formattedDate}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-wrap rounded-md bg-muted p-4">{adminResponse.response_text}</div>
        </div>

        <Alert>
          <AlertDescription>
            Please review the response above and either approve to proceed, or provide feedback if you need
            clarification or changes.
          </AlertDescription>
        </Alert>

        {showFeedbackForm && (
          <form onSubmit={handleProvideFeedback} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedback_text">
                Your Feedback <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="feedback_text"
                placeholder="Provide feedback, questions, or clarifications needed..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={6}
                className="resize-none"
                required
                minLength={10}
                maxLength={5000}
                disabled={feedbackMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                {feedbackText.length} / 5000 characters (minimum 10)
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowFeedbackForm(false)
                  setFeedbackText('')
                }}
                disabled={feedbackMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={feedbackMutation.isPending || feedbackText.trim().length < 10}
              >
                {feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>

      {!showFeedbackForm && (
        <CardFooter className="flex gap-2">
          <Button onClick={handleApprove} disabled={feedbackMutation.isPending} className="flex-1 sm:flex-none">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {feedbackMutation.isPending ? 'Approving...' : 'Approve & Proceed'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFeedbackForm(true)}
            disabled={feedbackMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Provide Feedback
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
