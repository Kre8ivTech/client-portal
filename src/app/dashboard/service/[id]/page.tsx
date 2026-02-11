
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, Calendar, DollarSign, AlertCircle, Clock } from 'lucide-react'
import Link from 'next/link'

import { CancelRequestButton } from '@/components/services/cancel-request-button'
import { ClientResponseView } from '@/components/services/ClientResponseView'
import { ResponseTimeline } from '@/components/services/ResponseTimeline'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ServiceRequestPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile for permission check
  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return <div>Profile not found</div>
  }

  const p = profile as { organization_id: string | null; role: string }

  // Fetch service request
  const { data: request, error } = await (supabase as any)
    .from('service_requests')
    .select(`
      *,
      service:services(id, name, base_rate, rate_type)
    `)
    .eq('id', id)
    .single()

  if (error || !request) {
    notFound()
  }

  // Fetch all responses for this service request
  const { data: responses } = await (supabase as any)
    .from('service_request_responses')
    .select(`
      *,
      responder:profiles!responder_id(id, name, email, avatar_url)
    `)
    .eq('service_request_id', id)
    .order('created_at', { ascending: true })

  const responseList = responses || []

  // Get the latest admin response (if any) for ClientResponseView
  const latestAdminResponse = responseList
    .filter((r: any) => r.response_type === 'admin_response')
    .pop()

  // Permission check
  if (p.organization_id && request.organization_id !== p.organization_id) {
    // If not in same org, check if super admin (handled by RLS usually but good to be safe)
    // Actually, let's just rely on RLS if possible, but manual check is good for UX (404 vs 403)
    // Here we just 404 if RLS didn't return it, but since we use service role sometimes (no, we use createServerSupabaseClient which is user context)
    // The previous fetch would fail if RLS works.
    // But explicitly:
    if (p.role !== 'super_admin') {
       // If client, enforce own request if that's the rule
       if (p.role === 'client' && request.requested_by !== user.id) {
         notFound()
       }
    }
  }

  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      responded: 'bg-purple-100 text-purple-700 border-purple-200',
      approved: 'bg-green-100 text-green-700 border-green-200',
      rejected: 'bg-red-100 text-red-700 border-red-200',
      converted: 'bg-blue-100 text-blue-700 border-blue-200',
      cancelled: 'bg-slate-100 text-slate-700 border-slate-200',
    }
    return colors[status] || colors.pending
  }

  const getPriorityColor = (priority: string | null) => {
    if (!priority) return 'text-muted-foreground'
    const colors: Record<string, string> = {
      low: 'text-slate-500',
      medium: 'text-blue-600',
      high: 'text-orange-600',
      urgent: 'text-red-600',
    }
    return colors[priority] || 'text-muted-foreground'
  }

  const formatRate = (rate: number | null, rateType: string) => {
    if (!rate) return 'Contact for quote'
    return `$${(rate / 100).toFixed(2)}`
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/service"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Service Requests
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {request.service?.name || 'Service Request'}
              </h1>
              <Badge variant="outline" className={getStatusColor(request.status)}>
                {request.status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              Request ID: <span className="font-mono">{request.id}</span>
            </p>
          </div>
          {request.status === 'pending' && (
             <CancelRequestButton requestId={request.id} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Request Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {request.details && typeof request.details === 'object' && 'notes' in request.details ? (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
                  <div className="p-4 bg-muted/30 rounded-md text-sm whitespace-pre-wrap">
                    {String(request.details.notes)}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No additional notes provided.</p>
              )}
              
              {/* Additional fields from details object can be rendered here */}
            </CardContent>
          </Card>

          {/* Client Response View - Shows if status is 'responded' and there's an admin response */}
          {request.status === 'responded' && latestAdminResponse && p.role === 'client' && (
            <ClientResponseView
              serviceRequestId={request.id}
              adminResponse={{
                response_text: latestAdminResponse.response_text,
                created_at: latestAdminResponse.created_at,
                responder: {
                  name: latestAdminResponse.responder?.name || null,
                  email: latestAdminResponse.responder?.email || 'Team',
                },
              }}
            />
          )}

          {/* Response Timeline - Shows conversation history if there are responses */}
          {responseList.length > 0 && (
            <ResponseTimeline responses={responseList} />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Requested Start
                </span>
                <span className="text-sm font-medium">{formatDate(request.requested_start_date)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Priority
                </span>
                <span className={`text-sm font-medium capitalize ${getPriorityColor(request.priority)}`}>
                  {request.priority || 'Normal'}
                </span>
              </div>

              {request.service?.base_rate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Estimated Cost
                  </span>
                  <span className="text-sm font-medium">
                    {formatRate(request.service.base_rate, request.service.rate_type)}
                    <span className="text-muted-foreground font-normal text-xs ml-1">
                      ({request.service.rate_type})
                    </span>
                  </span>
                </div>
              )}

              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Created
                  </span>
                  <span className="text-sm">{formatDate(request.created_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
