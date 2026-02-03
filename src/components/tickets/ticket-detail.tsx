'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { TicketComments } from './ticket-comments'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { Calendar, User, Tag, Clock, ChevronLeft, Package } from 'lucide-react'
import Link from 'next/link'
import { Database } from '@/types/database'
import { TICKET_CATEGORIES } from '@/lib/validators/ticket'
import { DeliverableList } from './deliverable-list'
import { DeliverableForm } from './deliverable-form'
import { CloseTicketDialog } from './close-ticket-dialog'

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  creator?: {
    name: string | null
  }
  assigned_staff?: {
    id: string
    name: string | null
  } | null
}

interface TicketDetailProps {
  ticket: Ticket
  userId: string
  userRole?: string
  deliverables?: any[]
}

export function TicketDetail({ ticket: initialTicket, userId, userRole, deliverables = [] }: TicketDetailProps) {
  const [ticket, setTicket] = useState(initialTicket)
  const [currentDeliverables, setDeliverables] = useState(deliverables)
  const [staff, setStaff] = useState<any[]>([])
  const [isAssigning, setIsAssigning] = useState(false)
  const supabase = createClient() as any
  const canAssign = userRole === 'super_admin' || userRole === 'staff'
  const isStaff = userRole === 'super_admin' || userRole === 'staff' || userRole === 'partner' || userRole === 'partner_staff'

  const refreshDeliverables = async () => {
    const { data } = await supabase
      .from('deliverables')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false })
    
    if (data) setDeliverables(data)
  }

  useEffect(() => {
    if (canAssign) {
      const fetchStaff = async () => {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, name')
          .in('role', ['super_admin', 'staff'])
          .order('name')
        
        if (data) setStaff(data)
      }
      fetchStaff()
    }
  }, [canAssign, supabase])

  const handleAssign = async (staffId: string) => {
    setIsAssigning(true)
    const { error } = await supabase
      .from('tickets')
      .update({ assigned_to: staffId === 'unassigned' ? null : staffId })
      .eq('id', ticket.id)
    
    if (!error) {
      setTicket({ ...ticket, assigned_to: staffId === 'unassigned' ? null : staffId })
    }
    setIsAssigning(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link 
        href="/dashboard/tickets" 
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-4 w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Tickets
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              Ticket #{ticket.ticket_number}
            </span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{ticket.subject}</h1>
        </div>
        {isStaff && ticket.status !== 'closed' && (
          <CloseTicketDialog
            ticketId={ticket.id}
            ticketNumber={ticket.ticket_number}
            onClose={() => setTicket({ ...ticket, status: 'closed' })}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center">
                  <User className="h-3 w-3" />
                </div>
                <span className="font-semibold">{ticket.creator?.name || 'Anonymous'}</span>
                <span className="text-slate-400">•</span>
                <span>Original Request</span>
              </div>
              <span className="text-xs text-slate-400">
                {ticket.created_at ? format(new Date(ticket.created_at), 'MMMM d, yyyy h:mm a') : '—'}
              </span>
            </div>
            <CardContent className="p-6">
              <div className="prose prose-slate max-w-none prose-sm whitespace-pre-wrap text-slate-700 leading-relaxed">
                {ticket.description}
              </div>
            </CardContent>
          </Card>

          {/* Deliverables Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Deliverables & Reviews
              </h3>
              {isStaff && (
                <DeliverableForm ticketId={ticket.id} onSuccess={refreshDeliverables} />
              )}
            </div>
            <DeliverableList deliverables={currentDeliverables} isStaff={isStaff} />
          </div>

          <TicketComments ticketId={ticket.id} userId={userId} userRole={userRole} />
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900 border-b pb-3">Details</h3>
            
            <DetailItem 
              icon={<Clock className="h-4 w-4 text-slate-400" />} 
              label="Last Updated" 
              value={ticket.updated_at ? format(new Date(ticket.updated_at), 'MMM d, h:mm a') : '—'} 
            />
            
            <DetailItem 
              icon={<Calendar className="h-4 w-4 text-slate-400" />} 
              label="SLA Deadline" 
              value={ticket.sla_due_at ? format(new Date(ticket.sla_due_at), 'MMM d, yyyy') : 'No deadline'} 
            />
            
            <DetailItem
              icon={<Tag className="h-4 w-4 text-slate-400" />}
              label="Category"
              value={getCategoryLabel(ticket.category)}
            />

            {canAssign ? (
              <div className="pt-2 border-t mt-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-tighter mb-2 block">Assigned To</span>
                <Select
                  disabled={isAssigning}
                  onValueChange={handleAssign}
                  defaultValue={ticket.assigned_to || 'unassigned'}
                >
                  <SelectTrigger className="w-full h-9 text-xs">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <DetailItem
                icon={<User className="h-4 w-4 text-slate-400" />}
                label="Assigned To"
                value={ticket.assigned_staff?.name || 'Unassigned'}
              />
            )}
            
            <div className="pt-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-tighter mb-2 block">Tags</span>
              <div className="flex flex-wrap gap-1">
                {(ticket.tags as string[])?.length > 0 ? (
                  (ticket.tags as string[]).map(tag => (
                    <Badge key={tag} variant="secondary" className="text-[10px] font-bold uppercase">{tag}</Badge>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No tags</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="space-y-0.5">
        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">{label}</span>
        <span className="text-sm font-semibold text-slate-700">{value}</span>
      </div>
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  open: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  pending_client: 'bg-orange-100 text-orange-700 border-orange-200',
  resolved: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-slate-200 text-slate-700 border-slate-300',
}

function StatusBadge({ status }: { status: Ticket['status'] }) {
  return (
    <Badge className={`${STATUS_STYLES[status] ?? STATUS_STYLES.new} font-bold capitalize px-2.5 py-0.5 rounded-full border shadow-sm text-[11px]`}>
      {status.replace('_', ' ')}
    </Badge>
  )
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-50 text-slate-600 border-slate-200',
  medium: 'bg-blue-50 text-blue-600 border-blue-200',
  high: 'bg-orange-50 text-orange-600 border-orange-200',
  critical: 'bg-red-50 text-red-600 border-red-200',
}

function PriorityBadge({ priority }: { priority: Ticket['priority'] }) {
  return (
    <Badge variant="outline" className={`${PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium} font-bold capitalize px-2.5 py-0.5 rounded-full text-[11px] shadow-sm`}>
      {priority}
    </Badge>
  )
}

function getCategoryLabel(category: string | null): string {
  if (!category) return 'Uncategorized'
  const found = TICKET_CATEGORIES.find((c) => c.value === category)
  return found ? found.label : category.replace(/_/g, ' ')
}
