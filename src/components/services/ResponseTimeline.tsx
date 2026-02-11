'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CheckCircle2, MessageSquare, User } from 'lucide-react'

interface Response {
  id: string
  response_type: 'admin_response' | 'client_feedback'
  response_text: string
  is_approval: boolean | null
  created_at: string
  responder: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  } | null
}

interface ResponseTimelineProps {
  responses: Response[]
}

export function ResponseTimeline({ responses }: ResponseTimelineProps) {
  if (responses.length === 0) {
    return null
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email.slice(0, 2).toUpperCase()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Response History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {responses.map((response, index) => {
            const isAdmin = response.response_type === 'admin_response'
            const isApproval = response.is_approval

            return (
              <div key={response.id} className="relative">
                {/* Timeline line */}
                {index < responses.length - 1 && (
                  <div className="absolute left-5 top-12 h-full w-0.5 bg-border" />
                )}

                <div className="flex gap-4">
                  {/* Avatar */}
                  <Avatar className="h-10 w-10 border-2 border-background">
                    <AvatarImage src={response.responder?.avatar_url || undefined} />
                    <AvatarFallback className={isAdmin ? 'bg-blue-100' : 'bg-green-100'}>
                      {response.responder
                        ? getInitials(response.responder.name, response.responder.email)
                        : '??'}
                    </AvatarFallback>
                  </Avatar>

                  {/* Content */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">
                        {response.responder?.name || response.responder?.email || 'Unknown User'}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {isAdmin ? (
                          <>
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Team Response
                          </>
                        ) : isApproval ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Approved
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3 mr-1" />
                            Client Feedback
                          </>
                        )}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(response.created_at)}</span>
                    </div>

                    <div className="rounded-md bg-muted/50 p-4 text-sm whitespace-pre-wrap">
                      {response.response_text}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
