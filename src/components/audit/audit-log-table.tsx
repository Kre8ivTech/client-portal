"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Download, Printer, Calendar, Filter } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type AuditLog = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  user_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

interface AuditLogTableProps {
  initialLogs: AuditLog[];
}

export function AuditLogTable({ initialLogs }: AuditLogTableProps) {
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [isLoading, setIsLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const handleFilter = async () => {
    if (!dateFrom && !dateTo) {
      toast.error("Please select at least one date");
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo) params.append("to", dateTo);

      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch logs");

      const data = await response.json();
      setLogs(data.logs);
      toast.success(`Filtered ${data.logs.length} audit log entries`);
    } catch (error) {
      toast.error("Failed to filter audit logs");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFilter = async () => {
    setDateFrom("");
    setDateTo("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/audit-logs");
      if (!response.ok) throw new Error("Failed to fetch logs");

      const data = await response.json();
      setLogs(data.logs);
      toast.success("Filters cleared");
    } catch (error) {
      toast.error("Failed to clear filters");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo) params.append("to", dateTo);
      params.append("format", "csv");

      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to export logs");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Audit logs exported successfully");
    } catch (error) {
      toast.error("Failed to export audit logs");
      console.error(error);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow pop-ups to print");
      return;
    }

    const dateRange =
      dateFrom || dateTo
        ? `Date Range: ${dateFrom || "Beginning"} to ${dateTo || "Now"}`
        : "Last 30 Days";

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Audit Log - ${format(new Date(), "yyyy-MM-dd")}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              padding: 20px;
              max-width: 1200px;
              margin: 0 auto;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 8px;
            }
            .subtitle {
              color: #666;
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 12px;
              text-align: left;
            }
            th {
              background-color: #f5f5f5;
              font-weight: 600;
            }
            tr:nth-child(even) {
              background-color: #fafafa;
            }
            .badge {
              display: inline-block;
              padding: 4px 8px;
              background-color: #e5e7eb;
              border-radius: 4px;
              font-size: 12px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              color: #666;
              font-size: 12px;
            }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Audit Log</h1>
          <p class="subtitle">${dateRange} | Generated: ${format(new Date(), "PPpp")}</p>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Entity</th>
                <th>User ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${logs
                .map(
                  (log) => `
                <tr>
                  <td>${format(new Date(log.created_at), "PPpp")}</td>
                  <td><span class="badge">${log.action}</span></td>
                  <td>${
                    log.entity_type && log.entity_id
                      ? `${log.entity_type} ${log.entity_id.slice(0, 8)}…`
                      : "—"
                  }</td>
                  <td>${log.user_id ? `${log.user_id.slice(0, 8)}…` : "—"}</td>
                  <td>${
                    typeof log.details === "object" && log.details !== null
                      ? JSON.stringify(log.details).slice(0, 100)
                      : "—"
                  }</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          <div class="footer">
            <p>Total Entries: ${logs.length}</p>
            <p>KT-Portal Audit Log | Confidential</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);

    toast.success("Opening print dialog");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Audit Log Entries
            </CardTitle>
            <CardDescription>
              Filter by date range, export to CSV, or print for compliance records.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              {showFilters ? "Hide" : "Show"} Filters
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 p-4 border rounded-lg bg-muted/30 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  From Date
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  max={dateTo || undefined}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  To Date
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom || undefined}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleFilter}
                disabled={isLoading || (!dateFrom && !dateTo)}
                size="sm"
              >
                Apply Filter
              </Button>
              <Button
                variant="outline"
                onClick={handleClearFilter}
                disabled={isLoading}
                size="sm"
              >
                Clear Filter
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {!logs?.length ? (
          <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-8 text-center text-muted-foreground text-sm">
            No audit entries found for the selected date range.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Showing {logs.length} {logs.length === 1 ? "entry" : "entries"}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {format(new Date(log.created_at), "PPp")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.entity_type && log.entity_id
                          ? `${log.entity_type} ${log.entity_id.slice(0, 8)}…`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.user_id ? `${log.user_id.slice(0, 8)}…` : "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs text-muted-foreground">
                        {typeof log.details === "object" &&
                        log.details !== null
                          ? JSON.stringify(log.details).slice(0, 60) + "…"
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
