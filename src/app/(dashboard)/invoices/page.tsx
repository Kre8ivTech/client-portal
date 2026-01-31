import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Download, Plus } from "lucide-react";

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Invoices
          </h2>
          <p className="text-slate-500">
            View billing history and pay pending balances.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download size={18} />
            Export CSV
          </Button>
          <Button className="gap-2">
            <Plus size={18} />
            New Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Unpaid" value="$12,450.00" />
        <StatsCard title="Past Due" value="$1,200.00" />
        <StatsCard title="Paid (Last 30d)" value="$24,000.00" />
        <StatsCard title="Upcoming" value="3" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>View and manage all your invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
            <p className="text-slate-600 font-medium mb-1">Invoicing module coming soon</p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Invoice list, payment status, and payment history will appear here once the invoicing system is implemented.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
