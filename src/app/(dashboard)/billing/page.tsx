import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BillingUsage } from '@/components/billing/billing-usage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreditCard, Receipt, ShieldCheck, Zap, Info, AlertCircle } from 'lucide-react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'

export default async function BillingPage() {
  const supabase = (await createServerSupabaseClient()) as any
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get profile to find organization_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return <div>Organization not found</div>
  }

  // Get active plan assignment
  const { data: assignment } = await supabase
    .from('plan_assignments')
    .select('*, plans(*)')
    .eq('organization_id', profile.organization_id)
    .eq('status', 'active')
    .single()

  const plan = (assignment as any)?.plans

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Billing & Plans</h1>
          <p className="text-slate-500 mt-1">Manage your subscription, usage, and billing history.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/dashboard/billing/dispute">
              <AlertCircle className="w-4 h-4" />
              Dispute billing
            </Link>
          </Button>
          <Button className="gap-2 shadow-md bg-indigo-600 hover:bg-indigo-700">
            <CreditCard className="w-4 h-4" />
            Manage with Stripe
          </Button>
        </div>
      </div>

      {!assignment ? (
        <Card className="border-dashed border-2 bg-slate-50/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
              <CreditCard size={32} />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-xl font-bold text-slate-900">No Active Plan Found</h2>
              <p className="text-slate-500 text-sm">
                Your organization doesn't have an active subscription yet. Contact support or upgrade to get started with Support and Dev pools.
              </p>
            </div>
            <Button size="lg" className="px-8">View Available Plans</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Usage Section */}
          <SectionHeader title="Resource Utilization" description="Real-time tracking of your support and development hours." />
          <BillingUsage planAssignment={assignment} planDetails={plan} />

          {/* Plan Details & Next Billing */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2 border-slate-200">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ShieldCheck className="text-green-600 w-5 h-5" />
                  Active Subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{plan?.name}</h3>
                    <p className="text-sm text-slate-500">{plan?.description || 'No plan description available.'}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 px-3 py-1 font-bold">
                    ACTIVE
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
                  <DetailItem label="MONTHLY FEE" value={`$${plan?.monthly_fee}`} />
                  <DetailItem label="BILLING CYCLE" value="Monthly" />
                  <DetailItem label="AUTO-RENEW" value={assignment.auto_renew ? 'Enabled' : 'Disabled'} />
                  <DetailItem label="START DATE" value={format(new Date(assignment.start_date), 'MMM d, yyyy')} />
                  <DetailItem label="NEXT BILLING" value={format(new Date(assignment.next_billing_date), 'MMM d, yyyy')} />
                  <DetailItem label="PAYMENT TERMS" value={`${plan?.payment_terms_days} Days`} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-slate-900 text-white shadow-xl shadow-slate-200">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Need assistance?</CardTitle>
                <CardDescription className="text-slate-400">Our billing team is available M-F 9am-5pm EST.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 flex gap-3">
                  <Info className="w-5 h-5 text-primary shrink-0" />
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Unused hours do not roll over to the next month unless specified in your custom contract terms.
                  </p>
                </div>
                <Button variant="outline" className="w-full bg-transparent border-slate-700 hover:bg-slate-800 text-white h-11">
                  Contact Billing Team
                </Button>
                <Button variant="ghost" className="w-full text-slate-400 hover:text-white hover:bg-slate-800 text-xs">
                  Review Contract Terms
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}
