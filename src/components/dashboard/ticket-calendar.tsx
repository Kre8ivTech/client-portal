'use client'

import { useState } from 'react'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  differenceInDays,
  isToday
} from 'date-fns'
import { ChevronLeft, ChevronRight, Ticket as TicketIcon, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { TicketPreviewDialog } from '@/components/tickets/ticket-preview-dialog'

type Ticket = {
  id: string
  ticket_number: number
  subject: string
  status: string
  priority: string
  created_at: string
  description?: string
}

interface TicketCalendarProps {
  tickets: Ticket[]
}

export function TicketCalendar({ tickets }: TicketCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const goToToday = () => setCurrentMonth(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const getDayTickets = (date: Date) => {
    return tickets.filter(ticket => isSameDay(new Date(ticket.created_at), date))
  }

  const getTicketAgeColor = (ticket: Ticket) => {
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      return 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
    }

    const age = differenceInDays(new Date(), new Date(ticket.created_at))
    
    if (age < 3) return 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
    if (age < 7) return 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200'
    return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
  }

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setIsDialogOpen(true)
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">Ticket Calendar</CardTitle>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-medium text-sm min-w-[100px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </div>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={goToToday}>
            Today
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground bg-slate-50/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {calendarDays.map((day, dayIdx) => {
            const dayTickets = getDayTickets(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            
            return (
              <div
                key={day.toString()}
                className={cn(
                  "min-h-[100px] p-2 border-b border-r transition-colors hover:bg-slate-50/30 relative group",
                  !isCurrentMonth && "bg-slate-50/50 text-muted-foreground",
                  isToday(day) && "bg-blue-50/30"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span
                    className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                      isToday(day)
                        ? "bg-blue-600 text-white"
                        : "text-slate-700"
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {dayTickets.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-slate-100 text-slate-500">
                      {dayTickets.length}
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-1">
                  {dayTickets.slice(0, 3).map((ticket) => {
                     const age = differenceInDays(new Date(), new Date(ticket.created_at))
                     const isOpen = !['resolved', 'closed'].includes(ticket.status)

                     return (
                      <TooltipProvider key={ticket.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleTicketClick(ticket)}
                              className={cn(
                                "w-full text-left text-[10px] px-1.5 py-1 rounded border truncate flex items-center gap-1 transition-all",
                                getTicketAgeColor(ticket)
                              )}
                            >
                              <span className="font-bold shrink-0">#{ticket.ticket_number}</span>
                              <span className="truncate">{ticket.subject}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs max-w-[200px]">
                            <p className="font-bold">{ticket.subject}</p>
                            <div className="flex items-center gap-2 mt-1 text-slate-300">
                              <span className="capitalize">{ticket.status.replace('_', ' ')}</span>
                              {isOpen && <span>• {age} days open</span>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )
                  })}
                  {dayTickets.length > 3 && (
                    <div className="text-[10px] text-slate-400 pl-1 font-medium">
                      + {dayTickets.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>

      <TicketPreviewDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        ticket={selectedTicket} 
      />
    </Card>
  )
}
