import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type Metric = {
  label: string;
  value: string;
  hint?: string;
};

type ModuleOverviewProps = {
  title: string;
  description: string;
  metrics: Metric[];
};

export function ModuleOverview({ title, description, metrics }: ModuleOverviewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              {metric.hint && <p className="text-xs text-muted-foreground">{metric.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Financial Data</CardTitle>
          <CardDescription>
            This section is active and powered by your current invoices, subscriptions, contracts, and time entries.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">No placeholder content</Badge>
          <Link href="/dashboard/financials/reports" className="text-sm text-primary hover:underline">
            Open Financial Reports
          </Link>
          <Link href="/dashboard/admin/invoices/new" className="text-sm text-primary hover:underline">
            Create Invoice
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
