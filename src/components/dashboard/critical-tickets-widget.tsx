'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/cn'

interface CriticalTicket {
  id: string
  ticket_number: string
  subject: string
  priority: string
  status: string
  created_at: string
  time_elapsed_hours: number
}

interface CriticalTicketsWidgetProps {
  tickets: CriticalTicket[]
}

export function CriticalTicketsWidget({ tickets }: CriticalTicketsWidgetProps) {
  const criticalCount = tickets.filter(t => t.priority === 'critical').length
  const highCount = tickets.filter(t => t.priority === 'high').length
  const overdueCount = tickets.filter(t => t.time_elapsed_hours > 48).length

  return (
    <Card className="border-l-4 border-l-red-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Critical Tickets</CardTitle>
              <CardDescription className="text-xs">Requires immediate attention</CardDescription>
            </div>
          </div>
          <Badge variant="destructive" className="text-lg font-bold px-3 py-1">
            {tickets.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{highCount}</div>
            <div className="text-xs text-muted-foreground">High</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{overdueCount}</div>
            <div className="text-xs text-muted-foreground">Overdue</div>
          </div>
        </div>

        {/* Recent Critical Tickets */}
        {tickets.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Recent</div>
            {tickets.slice(0, 3).map((ticket) => (
              <Link
                key={ticket.id}
                href={`/dashboard/tickets/${ticket.id}`}
                className="block p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={ticket.priority === 'critical' ? 'destructive' : 'default'}
                        className="text-xs"
                      >
                        {ticket.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{ticket.ticket_number}</span>
                    </div>
                    <p className="text-sm font-medium truncate">{ticket.subject}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {Math.floor(ticket.time_elapsed_hours)}h
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="font-medium text-green-600">All clear!</p>
            <p className="text-xs">No critical tickets at the moment</p>
          </div>
        )}

        {tickets.length > 3 && (
          <Link
            href="/dashboard/tickets?priority=critical,high"
            className="block text-center text-sm text-primary hover:underline"
          >
            View all {tickets.length} critical tickets →
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
