'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { reviewDeliverable } from '@/lib/actions/deliverables'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

interface DeliverableReviewDialogProps {
  deliverable: any
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeliverableReviewDialog({ deliverable, open, onOpenChange }: DeliverableReviewDialogProps) {
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<'approved' | 'changes_requested' | null>(null)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!action) return
    
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const feedback = formData.get('feedback') as string
    
    try {
      const result = await reviewDeliverable({
        deliverable_id: deliverable.id,
        status: action,
        feedback
      })

      if (result.success) {
        toast({ title: 'Success', description: `Deliverable ${action === 'approved' ? 'approved' : 'marked for changes'}` })
        onOpenChange(false)
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to submit review', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review Deliverable</DialogTitle>
          <DialogDescription>
            {deliverable.title}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback / Comments</Label>
            <Textarea 
              id="feedback" 
              name="feedback" 
              required={action === 'changes_requested'}
              placeholder="Provide your feedback here..." 
              className="min-h-[100px]"
            />
          </div>
          
          <DialogFooter className="flex gap-2 sm:justify-between">
             <div className="flex gap-2 w-full justify-end">
                <Button 
                  type="submit" 
                  variant="destructive" 
                  onClick={() => setAction('changes_requested')}
                  disabled={loading}
                  className="flex-1 sm:flex-none"
                >
                  {loading && action === 'changes_requested' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <XCircle className="mr-2 h-4 w-4" />
                  Request Changes
                </Button>
                <Button 
                  type="submit" 
                  onClick={() => setAction('approved')}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                >
                  {loading && action === 'approved' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
             </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
