'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { TicketList } from '@/components/tickets'
import { CreateTicketForm } from '@/components/tickets'
import { Plus, ArrowLeft } from 'lucide-react'
import type { TicketWithRelations } from '@/types/tickets'
import type { CreateTicketInput } from '@/lib/validators/ticket'

// Mock data for development - will be replaced with real data from Supabase
const MOCK_TICKETS: TicketWithRelations[] = [
  {
    id: '1',
    organization_id: 'org-1',
    ticket_number: 'KT-0001',
    subject: 'Website loading slowly on mobile devices',
    description: 'The homepage takes over 5 seconds to load on mobile. We have tried clearing cache but the issue persists. This is affecting our mobile conversion rate significantly.',
    priority: 'high',
    status: 'in_progress',
    category: 'technical-support',
    tags: ['performance', 'mobile'],
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
  },
  {
    id: '2',
    organization_id: 'org-1',
    ticket_number: 'KT-0002',
    subject: 'Unable to process credit card payments',
    description: 'Customers are reporting that credit card payments are failing at checkout. Error message says "Payment processing error". This started happening this morning.',
    priority: 'critical',
    status: 'new',
    category: 'billing',
    tags: ['payments', 'urgent'],
    created_by: 'user-2',
    assigned_to: null,
    parent_ticket_id: null,
    client_org_id: null,
    sla_due_at: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    first_response_at: null,
    resolved_at: null,
    queue_position: 1,
    queue_calculated_at: new Date().toISOString(),
    custom_fields: {},
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    created_by_profile: {
      id: 'user-2',
      name: 'Emily Johnson',
      email: 'emily@acmecorp.com',
      avatar_url: null,
    },
    comments_count: 0,
  },
  {
    id: '3',
    organization_id: 'org-1',
    ticket_number: 'KT-0003',
    subject: 'Request for new user accounts',
    description: 'We need to add 5 new team members to our portal. Please create accounts for the following users: ...',
    priority: 'low',
    status: 'pending_client',
    category: 'general-inquiry',
    tags: ['accounts'],
    created_by: 'user-1',
    assigned_to: 'staff-2',
    parent_ticket_id: null,
    client_org_id: null,
    sla_due_at: null,
    first_response_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    resolved_at: null,
    queue_position: null,
    queue_calculated_at: null,
    custom_fields: {},
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    created_by_profile: {
      id: 'user-1',
      name: 'John Smith',
      email: 'john@example.com',
      avatar_url: null,
    },
    assigned_to_profile: {
      id: 'staff-2',
      name: 'Mike Support',
      email: 'mike@kre8ivtech.com',
      avatar_url: null,
    },
    comments_count: 5,
  },
  {
    id: '4',
    organization_id: 'org-1',
    ticket_number: 'KT-0004',
    subject: 'Feature request: Dark mode support',
    description: 'It would be great if the portal supported a dark mode option. Many of our team members prefer working with dark themes.',
    priority: 'low',
    status: 'open',
    category: 'feature-request',
    tags: ['ui', 'enhancement'],
    created_by: 'user-3',
    assigned_to: null,
    parent_ticket_id: null,
    client_org_id: null,
    sla_due_at: null,
    first_response_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    resolved_at: null,
    queue_position: 5,
    queue_calculated_at: new Date().toISOString(),
    custom_fields: {},
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    created_by_profile: {
      id: 'user-3',
      name: 'Alex Chen',
      email: 'alex@techstartup.io',
      avatar_url: null,
    },
    comments_count: 2,
  },
  {
    id: '5',
    organization_id: 'org-1',
    ticket_number: 'KT-0005',
    subject: 'SSL certificate expiring soon',
    description: 'Our SSL certificate expires in 2 weeks. Please help us renew it before it expires.',
    priority: 'medium',
    status: 'resolved',
    category: 'technical-support',
    tags: ['ssl', 'maintenance'],
    created_by: 'user-1',
    assigned_to: 'staff-1',
    parent_ticket_id: null,
    client_org_id: null,
    sla_due_at: null,
    first_response_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    queue_position: null,
    queue_calculated_at: null,
    custom_fields: {},
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
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
    comments_count: 4,
  },
]

type ViewMode = 'list' | 'create'

export default function TicketsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [tickets, setTickets] = useState<TicketWithRelations[]>(MOCK_TICKETS)
  const router = useRouter()

  const handleTicketClick = (ticket: TicketWithRelations) => {
    // In production, this would navigate to the ticket detail page
    // router.push(`/tickets/${ticket.id}`)
    console.log('Ticket clicked:', ticket.ticket_number)
    alert(`Navigate to ticket ${ticket.ticket_number} (not implemented yet)`)
  }

  const handleCreateTicket = async (data: CreateTicketInput) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Create mock ticket
    const newTicket: TicketWithRelations = {
      id: `mock-${Date.now()}`,
      organization_id: 'org-1',
      ticket_number: `KT-${String(tickets.length + 1).padStart(4, '0')}`,
      subject: data.subject,
      description: data.description,
      priority: data.priority || 'medium',
      status: 'new',
      category: data.category || null,
      tags: data.tags || [],
      created_by: 'current-user',
      assigned_to: null,
      parent_ticket_id: null,
      client_org_id: null,
      sla_due_at: null,
      first_response_at: null,
      resolved_at: null,
      queue_position: tickets.filter(t => ['new', 'open'].includes(t.status)).length + 1,
      queue_calculated_at: new Date().toISOString(),
      custom_fields: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by_profile: {
        id: 'current-user',
        name: 'You',
        email: 'you@example.com',
        avatar_url: null,
      },
      comments_count: 0,
    }

    setTickets([newTicket, ...tickets])
    setViewMode('list')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {viewMode === 'create' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('list')}
              className="md:hidden"
            >
              <ArrowLeft size={20} />
            </Button>
          )}
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              {viewMode === 'create' ? 'Create Ticket' : 'Tickets'}
            </h2>
            <p className="text-slate-500 mt-1 hidden md:block">
              {viewMode === 'create' 
                ? 'Submit a new support request'
                : 'Manage support requests and track queue positions'
              }
            </p>
          </div>
        </div>
        
        {viewMode === 'list' && (
          <Button onClick={() => setViewMode('create')} className="gap-2">
            <Plus size={18} />
            <span className="hidden sm:inline">Create Ticket</span>
            <span className="sm:hidden">New</span>
          </Button>
        )}
      </div>

      {/* Content */}
      {viewMode === 'list' ? (
        <TicketList
          tickets={tickets}
          onTicketClick={handleTicketClick}
          onCreateClick={() => setViewMode('create')}
        />
      ) : (
        <div className="flex justify-center">
          <CreateTicketForm
            onSubmit={handleCreateTicket}
            onCancel={() => setViewMode('list')}
          />
        </div>
      )}
    </div>
  )
}
