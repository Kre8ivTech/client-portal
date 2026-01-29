'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { TicketDetail } from '@/components/tickets/ticket-detail'
import { CommentThread } from '@/components/tickets/comment-thread'
import { CompletionEstimateCard } from '@/components/tickets/completion-estimate'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'
import type { TicketWithRelations, TicketStatus, TicketCommentWithUser } from '@/types/tickets'
import type { CompletionEstimate } from '@/types/ai'

// Mock data - will be replaced with real Supabase queries
const MOCK_TICKET: TicketWithRelations = {
  id: '1',
  organization_id: 'org-1',
  ticket_number: 'KT-0001',
  subject: 'Website loading slowly on mobile devices',
  description: `The homepage takes over 5 seconds to load on mobile devices. We have tried the following troubleshooting steps:

1. Cleared browser cache
2. Tested on multiple devices (iPhone 13, Samsung Galaxy S21)
3. Checked our internet connection

The issue persists across all mobile browsers (Safari, Chrome, Firefox). Desktop loading times are normal (under 2 seconds).

This is significantly impacting our mobile conversion rate, which has dropped 15% this week.

Please investigate and let us know what might be causing this slowdown.`,
  priority: 'high',
  status: 'in_progress',
  category: 'technical-support',
  tags: ['performance', 'mobile', 'urgent'],
  created_by: 'user-1',
  assigned_to: 'staff-1',
  parent_ticket_id: null,
  client_org_id: null,
  sla_due_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  first_response_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  resolved_at: null,
  queue_position: 2,
  queue_calculated_at: new Date().toISOString(),
  custom_fields: {},
  created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  created_by_profile: {
    id: 'user-1',
    name: 'John Smith',
    email: 'john@example.com',
    avatar_url: null,
  },
  assigned_to_profile: {
    id: 'staff-1',
    name: 'Sarah Tech',
    email: 'sarah@kre8ivtech.com',
    avatar_url: null,
  },
  comments_count: 3,
}

// Mock completion estimate - will be computed by AI service
const MOCK_COMPLETION_ESTIMATE: CompletionEstimate = {
  ticket_id: '1',
  estimated_start_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().split('T')[0],
  estimated_completion_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  confidence_level: 'medium',
  confidence_percent: 72,
  estimated_hours: 6,
  complexity_score: 0.65,
  factors: [
    {
      factor: 'High priority',
      impact: 'decreases',
      description: 'Prioritized and will be worked on soon',
      weight: 0.2,
    },
    {
      factor: 'Queue position',
      impact: 'increases',
      description: '1 ticket ahead in queue',
      weight: 0.1,
    },
    {
      factor: 'Medium complexity',
      impact: 'neutral',
      description: 'Issue requires investigation but is well-documented',
      weight: 0.15,
    },
  ],
  assigned_to: 'staff-1',
  staff_availability: [
    { date: new Date(Date.now()).toISOString().split('T')[0], available_hours: 6, blocked_hours: 2, net_hours: 4 },
    { date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], available_hours: 6, blocked_hours: 1, net_hours: 5 },
    { date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], available_hours: 6, blocked_hours: 0, net_hours: 6 },
    { date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], available_hours: 6, blocked_hours: 3, net_hours: 3 },
  ],
  queue_position: 2,
  tickets_ahead: 1,
  client_message: 'We expect to complete this by Friday. Your ticket has been assigned to Sarah Tech who specializes in performance issues.',
}

const MOCK_COMMENTS: TicketCommentWithUser[] = [
  {
    id: 'c1',
    ticket_id: '1',
    user_id: 'staff-1',
    content: `Hi John,

Thank you for reporting this issue. I'm looking into it now.

Could you please provide:
1. The specific URLs that are slow
2. Screenshots of the Network tab in Chrome DevTools if possible
3. Your approximate location (for CDN testing)

This will help me diagnose the issue faster.`,
    is_internal: false,
    attachments: [],
    created_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    user: {
      id: 'staff-1',
      name: 'Sarah Tech',
      email: 'sarah@kre8ivtech.com',
      avatar_url: null,
      role: 'staff',
    },
  },
  {
    id: 'c2',
    ticket_id: '1',
    user_id: 'staff-1',
    content: 'Checked server logs - seeing high image sizes on mobile. May need to implement responsive images. Will update after further investigation.',
    is_internal: true,
    attachments: [],
    created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    user: {
      id: 'staff-1',
      name: 'Sarah Tech',
      email: 'sarah@kre8ivtech.com',
      avatar_url: null,
      role: 'staff',
    },
  },
  {
    id: 'c3',
    ticket_id: '1',
    user_id: 'user-1',
    content: `Hi Sarah,

Here's the information you requested:

1. The slow pages are:
   - Homepage: https://example.com/
   - Product listing: https://example.com/products
   
2. I've attached a screenshot from the Network tab

3. We're located in New York, NY

Let me know if you need anything else!`,
    is_internal: false,
    attachments: [
      {
        id: 'a1',
        filename: 'network-screenshot.png',
        url: '#',
        size: 245000,
        type: 'image/png',
      },
    ],
    created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    user: {
      id: 'user-1',
      name: 'John Smith',
      email: 'john@example.com',
      avatar_url: null,
      role: 'client',
    },
  },
]

export default function TicketDetailPage() {
  const router = useRouter()
  const params = useParams()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<TicketWithRelations | null>(null)
  const [comments, setComments] = useState<TicketCommentWithUser[]>([])
  const [estimate, setEstimate] = useState<CompletionEstimate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Simulate fetching ticket data
  useEffect(() => {
    const fetchTicket = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // In production, this would fetch from Supabase
        // For now, use mock data
        setTicket(MOCK_TICKET)
        setComments(MOCK_COMMENTS)
        setEstimate(MOCK_COMPLETION_ESTIMATE)
      } catch (err) {
        setError('Failed to load ticket')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTicket()
  }, [ticketId])

  const handleBack = () => {
    router.push('/tickets')
  }

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticket) return

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300))
    
    setTicket({
      ...ticket,
      status: newStatus,
      updated_at: new Date().toISOString(),
      resolved_at: newStatus === 'resolved' ? new Date().toISOString() : ticket.resolved_at,
    })
  }

  const handleAddComment = async (content: string, isInternal: boolean) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))

    const newComment: TicketCommentWithUser = {
      id: `c${Date.now()}`,
      ticket_id: ticketId,
      user_id: 'current-user',
      content,
      is_internal: isInternal,
      attachments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: {
        id: 'current-user',
        name: 'You',
        email: 'you@example.com',
        avatar_url: null,
        role: 'client', // Would come from auth context
      },
    }

    setComments([...comments, newComment])
  }

  const handleEditComment = async (commentId: string, content: string) => {
    await new Promise(resolve => setTimeout(resolve, 300))

    setComments(comments.map(c => 
      c.id === commentId 
        ? { ...c, content, updated_at: new Date().toISOString() }
        : c
    ))
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return

    await new Promise(resolve => setTimeout(resolve, 300))
    setComments(comments.filter(c => c.id !== commentId))
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-slate-500">Loading ticket...</p>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          {error || 'Ticket not found'}
        </h2>
        <p className="text-slate-500 mb-4">
          The ticket you're looking for doesn't exist or you don't have access to it.
        </p>
        <Button onClick={handleBack}>
          Back to Tickets
        </Button>
      </div>
    )
  }

  // For demo, assume user is staff (would come from auth context)
  const isStaff = true
  const currentUserId = 'current-user'

  return (
    <div className="space-y-6">
      <TicketDetail
        ticket={ticket}
        onBack={handleBack}
        onStatusChange={handleStatusChange}
        isStaff={isStaff}
      />

      {/* Show completion estimate for open/in-progress tickets */}
      {estimate && ticket.status !== 'closed' && ticket.status !== 'resolved' && (
        <CompletionEstimateCard 
          estimate={estimate} 
          showDetails={isStaff} // Staff see full details, clients see summary
        />
      )}

      <CommentThread
        comments={comments}
        ticketId={ticketId}
        onAddComment={handleAddComment}
        onEditComment={handleEditComment}
        onDeleteComment={handleDeleteComment}
        isStaff={isStaff}
        currentUserId={currentUserId}
      />
    </div>
  )
}
