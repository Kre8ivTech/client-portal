import { requireRole } from "@/lib/require-role";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import {
  DollarSign,
  FileText,
  Clock,
  Receipt,
  Repeat,
  Users,
  CreditCard,
  TrendingUp,
  FileSignature,
  PieChart,
  BarChart3,
  Package,
  Scale,
  Landmark,
  Target,
  LineChart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type FinancialModule = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const financialModules: FinancialModule[] = [
  {
    title: "Invoicing & Revenue",
    description: "Manage invoices, track revenue streams, and monitor payment status",
    href: "/dashboard/financials/invoicing",
    icon: FileText,
  },
  {
    title: "Accounts Receivable",
    description: "Track outstanding receivables, aging reports, and collections",
    href: "/dashboard/financials/receivables",
    icon: DollarSign,
  },
  {
    title: "Time Tracking & Utilization",
    description: "Monitor billable hours, staff utilization, and productivity metrics",
    href: "/dashboard/financials/time-tracking",
    icon: Clock,
  },
  {
    title: "Expenses & Reimbursements",
    description: "Track business expenses, manage reimbursements, and expense reports",
    href: "/dashboard/financials/expenses",
    icon: Receipt,
  },
  {
    title: "Subscriptions & Recurring",
    description: "Manage recurring revenue, subscriptions, and retainer agreements",
    href: "/dashboard/financials/subscriptions",
    icon: Repeat,
  },
  {
    title: "Payroll & Labor Costs",
    description: "Track payroll expenses, benefits, and total labor costs",
    href: "/dashboard/financials/payroll",
    icon: Users,
  },
  {
    title: "Accounts Payable",
    description: "Manage vendor bills, payment obligations, and payment schedules",
    href: "/dashboard/financials/payables",
    icon: CreditCard,
  },
  {
    title: "Cash Position & Runway",
    description: "Monitor cash flow, burn rate, and financial runway projections",
    href: "/dashboard/financials/cash-flow",
    icon: TrendingUp,
  },
  {
    title: "Contracts & Agreements",
    description: "Track client contracts, terms, and financial commitments",
    href: "/dashboard/financials/contracts",
    icon: FileSignature,
  },
  {
    title: "Cost Structure & Categories",
    description: "Analyze cost breakdown, expense categorization, and spend patterns",
    href: "/dashboard/financials/cost-structure",
    icon: PieChart,
  },
  {
    title: "Unit Economics & Margins",
    description: "Calculate customer lifetime value, unit economics, and profit margins",
    href: "/dashboard/financials/unit-economics",
    icon: BarChart3,
  },
  {
    title: "Asset Tracking",
    description: "Manage fixed assets, equipment, and depreciation schedules",
    href: "/dashboard/financials/assets",
    icon: Package,
  },
  {
    title: "Taxes & Compliance",
    description: "Track tax obligations, compliance requirements, and filing deadlines",
    href: "/dashboard/financials/taxes",
    icon: Scale,
  },
  {
    title: "Debt & Obligations",
    description: "Monitor long-term debt, leases, and financial obligations",
    href: "/dashboard/financials/debt",
    icon: Landmark,
  },
  {
    title: "Budgeting & Forecasting",
    description: "Create budgets, forecast revenue, and track variance analysis",
    href: "/dashboard/financials/budgeting",
    icon: Target,
  },
  {
    title: "Financial Reports & Metrics",
    description: "Access P&L statements, balance sheets, and key performance metrics",
    href: "/dashboard/financials/reports",
    icon: LineChart,
  },
];

export default async function FinancialsPage() {
  await requireRole(["super_admin", "staff"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financial Management</h1>
        <p className="text-muted-foreground">
          Comprehensive financial oversight, reporting, and analysis tools for your organization.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {financialModules.map((module) => (
          <Link key={module.href} href={module.href}>
            <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <module.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {module.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
