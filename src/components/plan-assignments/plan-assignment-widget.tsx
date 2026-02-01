"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Code, TrendingUp, Calendar, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import Link from "next/link";

interface PlanAssignmentWidgetProps {
  planAssignment: {
    id: string;
    status: string;
    support_hours_used: number | null;
    dev_hours_used: number | null;
    start_date: string;
    next_billing_date: string;
    auto_renew: boolean | null;
    plans: {
      id: string;
      name: string;
      description: string | null;
      support_hours_included: number;
      dev_hours_included: number;
      support_hourly_rate: number;
      dev_hourly_rate: number;
      monthly_fee: number;
    } | null;
  };
  showActions?: boolean;
  compact?: boolean;
}

export function PlanAssignmentWidget({
  planAssignment,
  showActions = true,
  compact = false,
}: PlanAssignmentWidgetProps) {
  const plan = planAssignment.plans;

  const supportUsed = planAssignment.support_hours_used ?? 0;
  const supportLimit = plan?.support_hours_included ?? 0;
  const supportPercentage = supportLimit > 0 ? Math.min((supportUsed / supportLimit) * 100, 100) : 0;
  const supportRemaining = Math.max(0, supportLimit - supportUsed);

  const devUsed = planAssignment.dev_hours_used ?? 0;
  const devLimit = plan?.dev_hours_included ?? 0;
  const devPercentage = devLimit > 0 ? Math.min((devUsed / devLimit) * 100, 100) : 0;
  const devRemaining = Math.max(0, devLimit - devUsed);

  const daysUntilRenewal = differenceInDays(new Date(planAssignment.next_billing_date), new Date());

  const isOverSupport = supportUsed > supportLimit && supportLimit > 0;
  const isOverDev = devUsed > devLimit && devLimit > 0;
  const isNearLimit = supportPercentage > 80 || devPercentage > 80;

  if (compact) {
    return (
      <Card className="border-slate-200">
        <CardContent className="pt-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-slate-900">{plan?.name ?? "Unknown Plan"}</h3>
              <p className="text-sm text-slate-500">
                Renews {format(new Date(planAssignment.next_billing_date), "MMM d, yyyy")}
              </p>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-blue-600">
                  <Clock className="h-3 w-3" />
                  Support
                </span>
                <span className="font-medium">{supportRemaining.toFixed(1)}h left</span>
              </div>
              <Progress
                value={supportPercentage}
                className={cn("h-2", supportPercentage > 90 ? "bg-red-100" : "bg-blue-100")}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-indigo-600">
                  <Code className="h-3 w-3" />
                  Dev
                </span>
                <span className="font-medium">{devRemaining.toFixed(1)}h left</span>
              </div>
              <Progress
                value={devPercentage}
                className={cn("h-2", devPercentage > 90 ? "bg-red-100" : "bg-indigo-100")}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Alert */}
      {(isOverSupport || isOverDev) && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-800">Hours Exceeded</h4>
            <p className="text-sm text-amber-700">
              You have exceeded your included hours. Additional time will be billed at overage rates.
            </p>
          </div>
        </div>
      )}

      {/* Hour Pools */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Support Pool */}
        <Card className="border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock size={80} />
          </div>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Clock className="text-blue-500 w-5 h-5" />
                  Support Pool
                </CardTitle>
                <CardDescription>Monthly support hours allocation</CardDescription>
              </div>
              {isOverSupport && (
                <Badge variant="destructive" className="animate-pulse">Over Limit</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-3xl font-extrabold text-slate-900">
                  {supportUsed.toFixed(1)} / {supportLimit}
                </p>
                <p className="text-xs text-slate-500 font-medium">HOURS CONSUMED</p>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "text-lg font-bold",
                    supportPercentage > 90 ? "text-red-500" : "text-slate-900"
                  )}
                >
                  {Math.round(supportPercentage)}%
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Progress
                value={supportPercentage}
                className={cn("h-3", supportPercentage > 90 ? "bg-red-100" : "bg-blue-100")}
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Start of Month</span>
                <span>100% Capacity</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-3">
              <TrendingUp className="w-4 h-4 text-slate-400 mt-0.5" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Additional support hours are billed at{" "}
                <span className="font-bold text-slate-900">
                  ${((plan?.support_hourly_rate ?? 0) / 100).toFixed(2)}/hr
                </span>
                .
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dev Pool */}
        <Card className="border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Code size={80} />
          </div>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Code className="text-indigo-500 w-5 h-5" />
                  Development Pool
                </CardTitle>
                <CardDescription>Dedicated dev hours allocation</CardDescription>
              </div>
              {isOverDev && (
                <Badge variant="destructive" className="animate-pulse">Over Limit</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-3xl font-extrabold text-slate-900">
                  {devUsed.toFixed(1)} / {devLimit}
                </p>
                <p className="text-xs text-slate-500 font-medium">HOURS CONSUMED</p>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "text-lg font-bold",
                    devPercentage > 90 ? "text-red-500" : "text-slate-900"
                  )}
                >
                  {Math.round(devPercentage)}%
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Progress
                value={devPercentage}
                className={cn("h-3", devPercentage > 90 ? "bg-red-100" : "bg-indigo-100")}
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Start of Month</span>
                <span>100% Capacity</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-3">
              <TrendingUp className="w-4 h-4 text-slate-400 mt-0.5" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Additional dev hours are billed at{" "}
                <span className="font-bold text-slate-900">
                  ${((plan?.dev_hourly_rate ?? 0) / 100).toFixed(2)}/hr
                </span>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Renewal Info */}
      <Card className="border-slate-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Next Billing Date</h4>
                <p className="text-sm text-slate-500">
                  {format(new Date(planAssignment.next_billing_date), "MMMM d, yyyy")}
                  {daysUntilRenewal > 0 && (
                    <span className="ml-2 text-slate-400">({daysUntilRenewal} days away)</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {planAssignment.auto_renew ? (
                <Badge variant="outline" className="gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Auto-renew on
                </Badge>
              ) : (
                <Badge variant="secondary">Auto-renew off</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {showActions && (
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/billing/history?assignment=${planAssignment.id}`}>
              View Time History
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/billing/dispute">Dispute Billing</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
