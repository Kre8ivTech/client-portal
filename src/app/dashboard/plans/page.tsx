import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlanList } from '@/components/plans/plan-list'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Check } from 'lucide-react'

export default async function PlansPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check user role - only super_admin and staff can access
  const { data: userRow } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  const role = (userRow as { role?: string } | null)?.role ?? 'client'

  if (role !== 'super_admin' && role !== 'staff' && role !== 'partner') {
    redirect('/dashboard')
  }

  // Check if Stripe is configured
  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Plan Management</h1>
          <p className="text-slate-500 mt-1">
            Create and manage subscription plans with Stripe integration.
          </p>
        </div>
      </div>

      {/* Stripe Status */}
      <Card className={stripeConfigured ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            {stripeConfigured ? (
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
            )}
            <div>
              <CardTitle className="text-base">
                Stripe Integration {stripeConfigured ? 'Connected' : 'Not Configured'}
              </CardTitle>
              <CardDescription>
                {stripeConfigured
                  ? 'Plans will be synced with Stripe Products and Prices automatically.'
                  : 'Set STRIPE_SECRET_KEY to enable automatic Stripe sync for plans.'}
              </CardDescription>
            </div>
            <Badge
              variant="secondary"
              className={
                stripeConfigured
                  ? 'ml-auto bg-green-100 text-green-700'
                  : 'ml-auto bg-amber-100 text-amber-700'
              }
            >
              {stripeConfigured ? 'Connected' : 'Offline'}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Plan List */}
      <PlanList />
    </div>
  )
}
