'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Ticket,
  FileText,
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Plus,
  DollarSign,
} from 'lucide-react'
import Link from 'next/link'
import { cn, formatDistanceToNow } from '@/lib/utils'
import { formatCents } from '@/types/invoices'

// Mock stats - would come from API/Supabase
const MOCK_STATS = {
  tickets: {
    open: 4,
    inProgress: 2,
    pendingClient: 1,
    resolvedToday: 3,
    avgResponseTime: '2.4h',
  },
  invoices: {
    draft: 1,
    outstanding: 3,
    overdueCount: 1,
    overdueAmount: 270000,
    paidThisMonth: 5,
    revenueThisMonth: 812375,
  },
  clients: {
    total: 6,
    active: 5,
    newThisMonth: 1,
  },
}

// Mock recent activity
const RECENT_ACTIVITY = [
  {
    id: '1',
    type: 'ticket',
    action: 'created',
    title: 'Unable to process credit card payments',
    actor: 'Emily Johnson',
    time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    priority: 'critical',
  },
  {
    id: '2',
    type: 'invoice',
    action: 'paid',
    title: 'Invoice KRE8I-2026-0002',
    actor: 'TechStartup Inc',
    time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    amount: 162375,
  },
  {
    id: '3',
    type: 'ticket',
    action: 'resolved',
    title: 'SSL certificate expiring soon',
    actor: 'Sarah Tech',
    time: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    type: 'client',
    action: 'joined',
    title: 'Creative Agency Co',
    actor: null,
    time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    type: 'invoice',
    action: 'sent',
    title: 'Invoice KRE8I-2026-0001',
    actor: 'Acme Corporation',
    time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    amount: 548774,
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page title - mobile only */}
      <div className="md:hidden">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Welcome back</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Tickets */}
        <Link href="/tickets">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Ticket className="h-5 w-5 text-blue-500" />
                {MOCK_STATS.tickets.open > 0 && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    {MOCK_STATS.tickets.inProgress} active
                  </Badge>
                )}
              </div>
              <CardDescription>Open Tickets</CardDescription>
              <CardTitle className="text-3xl">{MOCK_STATS.tickets.open}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500">
                {MOCK_STATS.tickets.pendingClient} awaiting response
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Outstanding Invoices */}
        <Link href="/invoices">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <DollarSign className="h-5 w-5 text-green-500" />
                {MOCK_STATS.invoices.overdueCount > 0 && (
                  <Badge variant="destructive">
                    {MOCK_STATS.invoices.overdueCount} overdue
                  </Badge>
                )}
              </div>
              <CardDescription>Outstanding</CardDescription>
              <CardTitle className="text-3xl">{MOCK_STATS.invoices.outstanding}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500">
                {formatCents(MOCK_STATS.invoices.revenueThisMonth)} this month
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Active Clients */}
        <Link href="/clients">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Users className="h-5 w-5 text-purple-500" />
                {MOCK_STATS.clients.newThisMonth > 0 && (
                  <Badge className="bg-green-100 text-green-700 border-0">
                    +{MOCK_STATS.clients.newThisMonth} new
                  </Badge>
                )}
              </div>
              <CardDescription>Active Clients</CardDescription>
              <CardTitle className="text-3xl">{MOCK_STATS.clients.active}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500">
                {MOCK_STATS.clients.total} total organizations
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Response Time */}
        <Card className="h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Clock className="h-5 w-5 text-orange-500" />
              <Badge className="bg-green-100 text-green-700 border-0">
                <TrendingUp size={12} className="mr-1" />
                Good
              </Badge>
            </div>
            <CardDescription>Avg Response</CardDescription>
            <CardTitle className="text-3xl">{MOCK_STATS.tickets.avgResponseTime}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              {MOCK_STATS.tickets.resolvedToday} resolved today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <Button variant="ghost" size="sm" className="text-slate-500">
                View all
                <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {RECENT_ACTIVITY.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/tickets">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Plus size={16} />
                Create Ticket
              </Button>
            </Link>
            <Link href="/invoices">
              <Button variant="outline" className="w-full justify-start gap-2">
                <FileText size={16} />
                New Invoice
              </Button>
            </Link>
            <Link href="/clients">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Users size={16} />
                Add Client
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Alerts section */}
      {MOCK_STATS.invoices.overdueCount > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-red-800">
                  {MOCK_STATS.invoices.overdueCount} overdue invoice{MOCK_STATS.invoices.overdueCount > 1 ? 's' : ''}
                </p>
                <p className="text-sm text-red-600">
                  {formatCents(MOCK_STATS.invoices.overdueAmount)} outstanding
                </p>
              </div>
              <Link href="/invoices?status=overdue">
                <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-100">
                  View
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Activity item component
function ActivityItem({ activity }: { activity: typeof RECENT_ACTIVITY[0] }) {
  const getIcon = () => {
    switch (activity.type) {
      case 'ticket':
        if (activity.action === 'resolved') return <CheckCircle size={16} className="text-green-500" />
        if (activity.priority === 'critical') return <AlertTriangle size={16} className="text-red-500" />
        return <Ticket size={16} className="text-blue-500" />
      case 'invoice':
        if (activity.action === 'paid') return <CheckCircle size={16} className="text-green-500" />
        return <FileText size={16} className="text-slate-500" />
      case 'client':
        return <Users size={16} className="text-purple-500" />
      default:
        return null
    }
  }

  const getDescription = () => {
    switch (activity.action) {
      case 'created':
        return <><span className="font-medium">{activity.actor}</span> created a ticket</>
      case 'resolved':
        return <><span className="font-medium">{activity.actor}</span> resolved a ticket</>
      case 'paid':
        return <><span className="font-medium">{activity.actor}</span> paid {formatCents(activity.amount || 0)}</>
      case 'sent':
        return <>Invoice sent to <span className="font-medium">{activity.actor}</span></>
      case 'joined':
        return <>New client joined</>
      default:
        return null
    }
  }

  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {activity.title}
        </p>
        <p className="text-xs text-slate-500">
          {getDescription()}
        </p>
      </div>
      <span className="text-xs text-slate-400 shrink-0">
        {formatDistanceToNow(activity.time)}
      </span>
    </div>
  )
}
