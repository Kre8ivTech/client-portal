"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Clock, CalendarDays } from "lucide-react";

type PlanAssignment = {
  id: string;
  status: string;
  start_date: string;
  next_billing_date: string;
  support_hours_used: number | null;
  dev_hours_used: number | null;
  plan: {
    id: string;
    name: string;
    monthly_fee: number;
    support_hours_included?: number;
    dev_hours_included?: number;
  } | null;
};

interface OrganizationPlanInfoProps {
  planAssignment: PlanAssignment | null;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function OrganizationPlanInfo({ planAssignment }: OrganizationPlanInfoProps) {
  if (!planAssignment || !planAssignment.plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Plan Assignment
          </CardTitle>
          <CardDescription>Subscription and usage information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-8 text-center text-muted-foreground">
            No active plan assigned to this organization.
          </div>
        </CardContent>
      </Card>
    );
  }

  const plan = planAssignment.plan;
  const supportHoursUsed = planAssignment.support_hours_used ?? 0;
  const devHoursUsed = planAssignment.dev_hours_used ?? 0;
  const supportHoursIncluded = (plan as { support_hours_included?: number }).support_hours_included ?? 0;
  const devHoursIncluded = (plan as { dev_hours_included?: number }).dev_hours_included ?? 0;

  const supportPercentage = supportHoursIncluded > 0 ? (supportHoursUsed / supportHoursIncluded) * 100 : 0;
  const devPercentage = devHoursIncluded > 0 ? (devHoursUsed / devHoursIncluded) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Plan Assignment
            </CardTitle>
            <CardDescription>Subscription and usage information</CardDescription>
          </div>
          <Badge
            variant={planAssignment.status === "active" ? "default" : "secondary"}
            className={
              planAssignment.status === "active"
                ? "bg-green-100 text-green-700 hover:bg-green-100"
                : ""
            }
          >
            {planAssignment.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Details */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div>
            <p className="font-semibold text-lg">{plan.name}</p>
            <p className="text-sm text-muted-foreground">Current plan</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-lg">{formatCurrency(plan.monthly_fee)}</p>
            <p className="text-sm text-muted-foreground">per month</p>
          </div>
        </div>

        {/* Billing Dates */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p className="font-medium">{formatDate(planAssignment.start_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Next Billing</p>
              <p className="font-medium">{formatDate(planAssignment.next_billing_date)}</p>
            </div>
          </div>
        </div>

        {/* Hours Usage */}
        {(supportHoursIncluded > 0 || devHoursIncluded > 0) && (
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hours Usage (Current Period)
            </h4>

            {supportHoursIncluded > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Support Hours</span>
                  <span className="font-medium">
                    {supportHoursUsed} / {supportHoursIncluded} hours
                  </span>
                </div>
                <Progress
                  value={Math.min(supportPercentage, 100)}
                  className={supportPercentage > 100 ? "[&>div]:bg-red-500" : ""}
                />
                {supportPercentage > 100 && (
                  <p className="text-xs text-red-600">
                    {(supportHoursUsed - supportHoursIncluded).toFixed(1)} overage hours
                  </p>
                )}
              </div>
            )}

            {devHoursIncluded > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Development Hours</span>
                  <span className="font-medium">
                    {devHoursUsed} / {devHoursIncluded} hours
                  </span>
                </div>
                <Progress
                  value={Math.min(devPercentage, 100)}
                  className={devPercentage > 100 ? "[&>div]:bg-red-500" : ""}
                />
                {devPercentage > 100 && (
                  <p className="text-xs text-red-600">
                    {(devHoursUsed - devHoursIncluded).toFixed(1)} overage hours
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
