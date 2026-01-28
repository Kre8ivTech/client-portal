export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard title="Open Tickets" value="4" description="2 awaiting response" />
        <StatsCard title="Active Projects" value="2" description="On track" />
        <StatsCard title="Current Plan" value="Support Plus" description="12 hours remaining" />
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm min-h-[400px]">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <p className="text-slate-500 italic">No recent activity to display.</p>
      </div>
    </div>
  )
}

function StatsCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
