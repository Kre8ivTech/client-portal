'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { DeliverableReviewDialog } from './deliverable-review-dialog'
import { formatDistanceToNow } from 'date-fns'

interface DeliverableListProps {
  deliverables: any[]
  isStaff: boolean
}

export function DeliverableList({ deliverables, isStaff }: DeliverableListProps) {
  const [reviewItem, setReviewItem] = useState<any | null>(null)

  if (!deliverables.length) {
    return (
      <div className="text-center p-6 border border-dashed rounded-lg text-muted-foreground">
        No deliverables yet.
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Approved</Badge>
      case 'changes_requested':
        return <Badge variant="destructive">Changes Requested</Badge>
      default:
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200">Pending Review</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {deliverables.map((item) => (
        <Card key={item.id} className="overflow-hidden">
          <CardHeader className="bg-muted/30 pb-3">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-base font-semibold">{item.title}</CardTitle>
                <CardDescription className="text-xs mt-1">
                  Version {item.version} • {formatDistanceToNow(new Date(item.created_at))} ago
                </CardDescription>
              </div>
              {getStatusBadge(item.status)}
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {item.description && (
              <p className="text-sm text-slate-600">{item.description}</p>
            )}
            
            {item.file_url && (
              <a 
                href={item.file_url} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center text-sm text-blue-600 hover:underline gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View Deliverable
              </a>
            )}

            {item.client_feedback && (
              <div className="bg-slate-50 p-3 rounded text-sm border">
                <p className="font-semibold text-xs text-slate-500 uppercase mb-1">Feedback</p>
                <p>{item.client_feedback}</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-muted/10 py-2 px-4 flex justify-end gap-2">
            {!isStaff && item.status === 'pending_review' && (
              <Button size="sm" onClick={() => setReviewItem(item)}>
                Review & Approve
              </Button>
            )}
          </CardFooter>
        </Card>
      ))}

      {reviewItem && (
        <DeliverableReviewDialog 
          deliverable={reviewItem} 
          open={!!reviewItem} 
          onOpenChange={(open) => !open && setReviewItem(null)} 
        />
      )}
    </div>
  )
}
