import { requireRole } from "@/lib/require-role";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LineChart, FileText, BarChart3, TrendingUp } from "lucide-react";

export default async function FinancialReportsPage() {
  await requireRole(["super_admin", "staff"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financial Reports & Performance Metrics</h1>
        <p className="text-muted-foreground">
          Access P&L statements, balance sheets, and key performance metrics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground">YTD</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground">YTD</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground">YTD</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
            <p className="text-xs text-muted-foreground">Net margin</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Financial Statements</CardTitle>
            <CardDescription>Core financial reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Income Statement (P&L)</div>
                    <div className="text-sm text-muted-foreground">Revenue and expenses</div>
                  </div>
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Balance Sheet</div>
                    <div className="text-sm text-muted-foreground">Assets and liabilities</div>
                  </div>
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Cash Flow Statement</div>
                    <div className="text-sm text-muted-foreground">Cash movements</div>
                  </div>
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Performance Indicators</CardTitle>
            <CardDescription>Financial health metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm text-muted-foreground">Current Ratio</span>
                <span className="text-sm font-medium">0.00</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm text-muted-foreground">Quick Ratio</span>
                <span className="text-sm font-medium">0.00</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm text-muted-foreground">Debt-to-Equity</span>
                <span className="text-sm font-medium">0.00</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm text-muted-foreground">Return on Assets (ROA)</span>
                <span className="text-sm font-medium">0%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Return on Equity (ROE)</span>
                <span className="text-sm font-medium">0%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial Reporting</CardTitle>
          <CardDescription>
            Comprehensive financial reporting and analytics coming soon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-12 text-center">
            <LineChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Advanced Financial Reports</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Generate comprehensive financial statements, custom reports, executive dashboards,
              and detailed analytics. Export to Excel, PDF, or integrate with accounting software.
              Schedule automated report delivery.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
