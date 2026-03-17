import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/require-role'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { DollarSign, Zap, Users, TrendingUp } from 'lucide-react'

export default async function AIUsagePage() {
  await requireRole(['super_admin', 'staff'])

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get today's date and 30 days ago
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Total requests (30 days)
  const { count: totalRequests } = await (supabase as any)
    .from('ai_usage_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${thirtyDaysAgo}T00:00:00Z`)

  // Total tokens (30 days)
  const { data: tokenData } = await (supabase as any)
    .from('ai_usage_logs')
    .select('input_tokens, output_tokens, estimated_cost_cents')
    .gte('created_at', `${thirtyDaysAgo}T00:00:00Z`)

  const totalInputTokens = (tokenData || []).reduce((sum: number, r: any) => sum + (r.input_tokens || 0), 0)
  const totalOutputTokens = (tokenData || []).reduce((sum: number, r: any) => sum + (r.output_tokens || 0), 0)
  const totalCostCents = (tokenData || []).reduce((sum: number, r: any) => sum + (r.estimated_cost_cents || 0), 0)
  const totalCostDollars = (totalCostCents / 100).toFixed(2)

  // Today's requests
  const { count: todayRequests } = await (supabase as any)
    .from('ai_usage_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00Z`)

  // Error count (30 days)
  const { count: errorCount } = await (supabase as any)
    .from('ai_usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'error')
    .gte('created_at', `${thirtyDaysAgo}T00:00:00Z`)

  // Unique users (30 days)
  const { data: uniqueUsersData } = await (supabase as any)
    .from('ai_usage_logs')
    .select('user_id')
    .gte('created_at', `${thirtyDaysAgo}T00:00:00Z`)
  const uniqueUsers = new Set((uniqueUsersData || []).map((r: any) => r.user_id)).size

  // Provider breakdown (30 days)
  const { data: providerData } = await (supabase as any)
    .from('ai_usage_logs')
    .select('provider, estimated_cost_cents, input_tokens, output_tokens')
    .gte('created_at', `${thirtyDaysAgo}T00:00:00Z`)

  const providerStats: Record<string, { requests: number; cost: number; tokens: number }> = {}
  for (const row of providerData || []) {
    if (!providerStats[row.provider]) {
      providerStats[row.provider] = { requests: 0, cost: 0, tokens: 0 }
    }
    providerStats[row.provider].requests++
    providerStats[row.provider].cost += row.estimated_cost_cents || 0
    providerStats[row.provider].tokens += (row.input_tokens || 0) + (row.output_tokens || 0)
  }

  // Top users (30 days)
  const { data: topUsersRaw } = await (supabase as any)
    .from('ai_usage_logs')
    .select('user_id, estimated_cost_cents, input_tokens, output_tokens')
    .gte('created_at', `${thirtyDaysAgo}T00:00:00Z`)

  const userStats: Record<string, { requests: number; cost: number; tokens: number }> = {}
  for (const row of topUsersRaw || []) {
    if (!row.user_id) continue
    if (!userStats[row.user_id]) {
      userStats[row.user_id] = { requests: 0, cost: 0, tokens: 0 }
    }
    userStats[row.user_id].requests++
    userStats[row.user_id].cost += row.estimated_cost_cents || 0
    userStats[row.user_id].tokens += (row.input_tokens || 0) + (row.output_tokens || 0)
  }

  const topUserIds = Object.entries(userStats)
    .sort(([, a], [, b]) => b.cost - a.cost)
    .slice(0, 10)
    .map(([id]) => id)

  // Fetch user names
  const { data: userProfiles } = await (supabase as any)
    .from('users')
    .select('id, email, full_name')
    .in('id', topUserIds.length > 0 ? topUserIds : ['00000000-0000-0000-0000-000000000000'])

  const userMap: Record<string, string> = {}
  for (const u of userProfiles || []) {
    userMap[u.id] = u.full_name || u.email || 'Unknown'
  }

  // Recent requests (last 20)
  const { data: recentRequests } = await (supabase as any)
    .from('ai_usage_logs')
    .select('id, user_id, provider, model, input_tokens, output_tokens, estimated_cost_cents, request_type, status, latency_ms, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  const errorRate = totalRequests ? ((errorCount || 0) / totalRequests * 100).toFixed(1) : '0'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Usage & Costs</h1>
        <p className="text-muted-foreground">Monitor AI provider usage, costs, and performance across your organization.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost (30d)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCostDollars}</div>
            <p className="text-xs text-muted-foreground">{(totalRequests || 0).toLocaleString()} requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens (30d)</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{((totalInputTokens + totalOutputTokens) / 1000).toFixed(1)}K</div>
            <p className="text-xs text-muted-foreground">In: {(totalInputTokens / 1000).toFixed(1)}K / Out: {(totalOutputTokens / 1000).toFixed(1)}K</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayRequests || 0}</div>
            <p className="text-xs text-muted-foreground">requests today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users (30d)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">Error rate: {errorRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Provider Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Provider Breakdown (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(providerStats).length === 0 ? (
            <p className="text-muted-foreground text-sm">No AI usage data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Provider</th>
                    <th className="text-right py-2 font-medium">Requests</th>
                    <th className="text-right py-2 font-medium">Tokens</th>
                    <th className="text-right py-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(providerStats).sort(([, a], [, b]) => b.cost - a.cost).map(([provider, stats]) => (
                    <tr key={provider} className="border-b last:border-0">
                      <td className="py-2 font-medium capitalize">{provider}</td>
                      <td className="py-2 text-right">{stats.requests.toLocaleString()}</td>
                      <td className="py-2 text-right">{(stats.tokens / 1000).toFixed(1)}K</td>
                      <td className="py-2 text-right font-mono">${(stats.cost / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Users by Cost (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {topUserIds.length === 0 ? (
            <p className="text-muted-foreground text-sm">No AI usage data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">User</th>
                    <th className="text-right py-2 font-medium">Requests</th>
                    <th className="text-right py-2 font-medium">Tokens</th>
                    <th className="text-right py-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {topUserIds.map((userId) => {
                    const stats = userStats[userId]
                    return (
                      <tr key={userId} className="border-b last:border-0">
                        <td className="py-2">{userMap[userId] || userId.slice(0, 8)}</td>
                        <td className="py-2 text-right">{stats.requests.toLocaleString()}</td>
                        <td className="py-2 text-right">{(stats.tokens / 1000).toFixed(1)}K</td>
                        <td className="py-2 text-right font-mono">${(stats.cost / 100).toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {(!recentRequests || recentRequests.length === 0) ? (
            <p className="text-muted-foreground text-sm">No AI usage data yet. Usage will appear here once users start using the AI assistant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Time</th>
                    <th className="text-left py-2 font-medium">User</th>
                    <th className="text-left py-2 font-medium">Provider</th>
                    <th className="text-left py-2 font-medium">Type</th>
                    <th className="text-right py-2 font-medium">Tokens</th>
                    <th className="text-right py-2 font-medium">Cost</th>
                    <th className="text-right py-2 font-medium">Latency</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.map((req: any) => (
                    <tr key={req.id} className="border-b last:border-0">
                      <td className="py-2 text-muted-foreground whitespace-nowrap">{new Date(req.created_at).toLocaleString()}</td>
                      <td className="py-2">{userMap[req.user_id] || (req.user_id?.slice(0, 8) || 'System')}</td>
                      <td className="py-2 capitalize">{req.provider}</td>
                      <td className="py-2 capitalize">{req.request_type?.replace('_', ' ')}</td>
                      <td className="py-2 text-right">{((req.input_tokens || 0) + (req.output_tokens || 0)).toLocaleString()}</td>
                      <td className="py-2 text-right font-mono">${((req.estimated_cost_cents || 0) / 100).toFixed(4)}</td>
                      <td className="py-2 text-right">{req.latency_ms ? `${req.latency_ms}ms` : '-'}</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          req.status === 'success' ? 'bg-green-100 text-green-700' :
                          req.status === 'error' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
