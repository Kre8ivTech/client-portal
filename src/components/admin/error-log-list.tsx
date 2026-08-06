"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clipboard,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatErrorForIssue, type ErrorLogRecord } from "@/lib/error-logs";

type ErrorLogListProps = {
  initialLogs: ErrorLogRecord[];
  loadError?: string;
};

export function ErrorLogList({ initialLogs, loadError }: ErrorLogListProps) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyErrorId, setCopyErrorId] = useState<string | null>(null);

  const visibleLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return initialLogs.filter((log) => {
      const matchesSource = source === "all" || log.source === source;
      const matchesQuery =
        !normalizedQuery ||
        [log.message, log.route, log.digest, log.environment, log.release, log.id]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedQuery));

      return matchesSource && matchesQuery;
    });
  }, [initialLogs, query, source]);

  const handleCopy = async (log: ErrorLogRecord) => {
    try {
      await navigator.clipboard.writeText(formatErrorForIssue(log));
      setCopyErrorId(null);
      setCopiedId(log.id);
      window.setTimeout(() => setCopiedId(null), 2_000);
    } catch {
      setCopiedId(null);
      setCopyErrorId(log.id);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b bg-muted/20 p-4 sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Recent errors</h2>
            <p className="text-sm text-muted-foreground">
              Showing the latest {initialLogs.length} captured dashboard errors.
            </p>
          </div>
          <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
            {visibleLogs.length} {visibleLogs.length === 1 ? "match" : "matches"}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <label className="relative block">
            <span className="sr-only">Search error logs</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search message, route, digest, or ID"
              className="pl-9"
            />
          </label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger aria-label="Filter by error source">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="react_error_boundary">React boundary</SelectItem>
              <SelectItem value="window_error">Window error</SelectItem>
              <SelectItem value="unhandled_rejection">Unhandled promise</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loadError ? (
          <div className="flex items-start gap-3 p-6 text-sm text-destructive" role="alert">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Error logs could not be loaded.</p>
              <p className="mt-1 text-muted-foreground">{loadError}</p>
            </div>
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-medium">No errors match these filters.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clear the search or choose a different source.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {visibleLogs.map((log) => (
              <article key={log.id} className="p-4 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive">{log.severity}</Badge>
                      <Badge variant="outline">{log.source.replaceAll("_", " ")}</Badge>
                      {log.environment ? <Badge variant="secondary">{log.environment}</Badge> : null}
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={log.created_at}
                      >
                        {format(new Date(log.created_at), "PPp")}
                      </time>
                    </div>
                    <p className="max-w-4xl break-words font-medium leading-6">{log.message}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Route: {log.route ?? "Unknown"}</span>
                      <span>Log ID: {log.id}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleCopy(log)}
                      aria-label={`Copy error ${log.id} for issue tracking`}
                    >
                      {copiedId === log.id ? <Check /> : <Clipboard />}
                      {copiedId === log.id ? "Copied" : "Copy for issue"}
                    </Button>
                  </div>
                </div>

                {copyErrorId === log.id ? (
                  <p className="mt-3 text-sm text-destructive" role="alert">
                    Clipboard access failed. Check browser permissions and try again.
                  </p>
                ) : null}

                <details className="group mt-4 rounded-md bg-muted/40">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                    Diagnostic details
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="space-y-4 border-t px-4 py-4 text-sm">
                    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-muted-foreground">User ID</dt>
                        <dd className="mt-1 break-all">{log.user_id ?? "Unknown"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Organization ID</dt>
                        <dd className="mt-1 break-all">{log.organization_id ?? "Unknown"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Digest</dt>
                        <dd className="mt-1 break-all">{log.digest ?? "None"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Release</dt>
                        <dd className="mt-1 break-all">{log.release ?? "Unknown"}</dd>
                      </div>
                    </dl>

                    <div>
                      <h3 className="font-medium">Stack trace</h3>
                      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 text-xs leading-5">
                        {log.stack_trace ?? "No stack trace captured."}
                      </pre>
                    </div>

                    <div>
                      <h3 className="font-medium">Client context</h3>
                      <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 text-xs leading-5">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
