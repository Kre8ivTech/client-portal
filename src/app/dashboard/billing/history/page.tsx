import { createServerSupabaseClient } from '@/lib/supabase/server'
import { TimeUsageHistory } from '@/components/plan-assignments'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Clock, Code } from 'lucide-react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'

type PlanRow = {
  id: string;
  name: string;
  support_hours_included: number;
  dev_hours_included: number;
}

type AssignmentRow = {
  id: string;
  status: string;
  support_hours_used: number | null;
  dev_hours_used: number | null;
  start_date: string;
  next_billing_date: string;
  plans: PlanRow | null;
  organizations: { id: string; name: string } | null;
}

export default async function BillingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ assignment?: string }>
}) {
  const { assignment: assignmentId } = await searchParams
  const supabase = (await createServerSupabaseClient()) as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return <div>Organization not found</div>
  }

  // If no assignment ID provided, find the active one for the user's org
  let targetAssignmentId = assignmentId

  if (!targetAssignmentId) {
    const { data: activeAssignment } = await supabase
      .from('plan_assignments')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('status', 'active')
      .single()

    targetAssignmentId = activeAssignment?.id
  }

  if (!targetAssignmentId) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" asChild className="gap-2">
            <Link href="/dashboard/billing">
              <ArrowLeft className="h-4 w-4" />
              Back to Billing
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No plan assignment found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fetch the assignment details
  const { data: assignment, error } = await supabase
    .from('plan_assignments')
    .select(`
      id,
      status,
      support_hours_used,
      dev_hours_used,
      start_date,
      next_billing_date,
      plans (
        id,
        name,
        support_hours_included,
        dev_hours_included
      ),
      organizations:organization_id (
        id,
        name
      )
    `)
    .eq('id', targetAssignmentId)
    .single()

  if (error || !assignment) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" asChild className="gap-2">
            <Link href="/dashboard/billing">
              <ArrowLeft className="h-4 w-4" />
              Back to Billing
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">Plan assignment not found or access denied.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const typedAssignment = assignment as AssignmentRow
  const plan = typedAssignment.plans

  // Calculate remaining hours
  const supportUsed = typedAssignment.support_hours_used ?? 0
  const supportIncluded = plan?.support_hours_included ?? 0
  const supportRemaining = Math.max(0, supportIncluded - supportUsed)

  const devUsed = typedAssignment.dev_hours_used ?? 0
  const devIncluded = plan?.dev_hours_included ?? 0
  const devRemaining = Math.max(0, devIncluded - devUsed)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" asChild className="gap-2 mb-2">
            <Link href="/dashboard/billing">
              <ArrowLeft className="h-4 w-4" />
              Back to Billing
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">Time Usage History</h1>
          <p className="text-muted-foreground">
            {typedAssignment.organizations?.name} - {plan?.name}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{supportUsed.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Support Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{supportRemaining.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Support Left</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Code className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{devUsed.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Dev Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Code className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{devRemaining.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Dev Left</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Period Info */}
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current Billing Period:</span>
            <span className="font-medium">
              {format(new Date(typedAssignment.start_date), 'MMM d, yyyy')} -{' '}
              {format(new Date(typedAssignment.next_billing_date), 'MMM d, yyyy')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Time Usage History Component */}
      <TimeUsageHistory planAssignmentId={targetAssignmentId} />
    </div>
  )
}
