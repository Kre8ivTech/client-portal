"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { Clock, Code, Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { formatHoursMinutes, calculateBillableHours } from "@/lib/utils";
import { format } from "date-fns";

type TimeEntry = {
  id: string;
  description: string;
  hours: number;
  entry_date: string;
  billable: boolean;
  work_type: "support" | "dev";
  ticket_id: string | null;
  created_at: string;
  user_id: string;
  users: { id: string; email: string } | null;
  tickets: { id: string; ticket_number: number; subject: string } | null;
};

interface TimeUsageHistoryProps {
  planAssignmentId: string;
  initialEntries?: TimeEntry[];
}

export function TimeUsageHistory({ planAssignmentId, initialEntries = [] }: TimeUsageHistoryProps) {
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries);
  const [loading, setLoading] = useState(!initialEntries.length);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "support" | "dev">("all");
  const limit = 10;

  useEffect(() => {
    if (!initialEntries.length) {
      loadEntries();
    }
  }, [page, filter]);

  async function loadEntries() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });

      if (filter !== "all") {
        params.set("work_type", filter);
      }

      const response = await fetch(`/api/plan-assignments/${planAssignmentId}/time?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load time entries");
      }

      setEntries(result.data || []);
      setTotalCount(result.count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load time entries");
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(totalCount / limit);

  // Calculate totals
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const supportHours = entries.filter((e) => e.work_type === "support").reduce((sum, e) => sum + e.hours, 0);
  const devHours = entries.filter((e) => e.work_type === "dev").reduce((sum, e) => sum + e.hours, 0);

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-slate-500" />
              Time Usage History
            </CardTitle>
            <CardDescription>Detailed breakdown of time logged against this plan</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => { setFilter("all"); setPage(0); }}
            >
              All
            </Button>
            <Button
              variant={filter === "support" ? "default" : "outline"}
              size="sm"
              onClick={() => { setFilter("support"); setPage(0); }}
              className="gap-1"
            >
              <Clock className="h-3 w-3" />
              Support
            </Button>
            <Button
              variant={filter === "dev" ? "default" : "outline"}
              size="sm"
              onClick={() => { setFilter("dev"); setPage(0); }}
              className="gap-1"
            >
              <Code className="h-3 w-3" />
              Dev
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900">{formatHoursMinutes(totalHours)}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Total Time</div>
          </div>
          <div className="text-center border-x border-slate-200">
            <div className="text-2xl font-bold text-blue-600">{formatHoursMinutes(supportHours)}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Support</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{formatHoursMinutes(devHours)}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Development</div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No time entries found for this plan assignment.
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Ticket</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                    <TableHead className="text-right">Billed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {format(new Date(entry.entry_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            entry.work_type === "support"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-indigo-200 bg-indigo-50 text-indigo-700"
                          }
                        >
                          {entry.work_type === "support" ? (
                            <Clock className="h-3 w-3 mr-1" />
                          ) : (
                            <Code className="h-3 w-3 mr-1" />
                          )}
                          {entry.work_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {entry.description}
                      </TableCell>
                      <TableCell>
                        {entry.tickets ? (
                          <span className="text-sm text-muted-foreground">
                            #{entry.tickets.ticket_number}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatHoursMinutes(entry.hours)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {entry.billable ? `${calculateBillableHours(entry.hours)}h` : (
                          <span className="text-xs">(non-billable)</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {page * limit + 1}-{Math.min((page + 1) * limit, totalCount)} of {totalCount} entries
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
