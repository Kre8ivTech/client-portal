import { formatDistanceToNow } from "date-fns";
import { wordpressPluginStatus } from "@/lib/sites/wp-plugins";
import type { WpPlugin } from "@/lib/partner-api/schemas";
import { cn } from "@/lib/utils";
import { parseMonitorDate } from "@/lib/sites/site-monitor-display";

type WordpressPluginStatusProps = {
  platform: string | null;
  plugins: unknown;
  updatedAt: string | null;
};

function pluginOrder(a: WpPlugin, b: WpPlugin) {
  const update = Number(Boolean(b.update_available)) - Number(Boolean(a.update_available));
  if (update !== 0) return update;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function snapshotLabel(updatedAt: string) {
  const parsed = parseMonitorDate(updatedAt);
  if (!parsed) return null;
  return formatDistanceToNow(parsed, { addSuffix: true });
}

function Stat({ label, value, emphasize }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <div className={cn("rounded-md bg-muted px-3 py-2", emphasize && "bg-warning/15")}>
      <p className="text-lg font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function WordPressPluginStatus({ platform, plugins, updatedAt }: WordpressPluginStatusProps) {
  const status = wordpressPluginStatus({ platform, plugins, updatedAt });
  if (!status.available) {
    return <p className="text-sm text-muted-foreground">Plugin status is unavailable.</p>;
  }

  const ordered = [...status.plugins].sort(pluginOrder);
  const seen = snapshotLabel(status.updatedAt);
  const totalLabel = status.summary.total === 1 ? "1 plugin" : `${status.summary.total} plugins`;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Active" value={status.summary.active} />
        <Stat label="Inactive" value={status.summary.inactive} />
        <Stat label="Updates" value={status.summary.updatesAvailable} emphasize={status.summary.updatesAvailable > 0} />
      </div>
      {seen ? <p className="text-xs text-muted-foreground">Plugin snapshot {seen}</p> : null}
      <details className="rounded-md border bg-background">
        <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium marker:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Plugin list
          <span className="ml-2 font-normal text-muted-foreground">{totalLabel}</span>
        </summary>
        {ordered.length === 0 ? (
          <p className="border-t px-3 py-3 text-sm text-muted-foreground">No plugins were reported.</p>
        ) : (
          <ul className="max-h-64 overflow-y-auto border-t">
            {ordered.map((plugin, index) => (
              <li
                key={`${plugin.file}-${index}`}
                className="flex flex-col gap-0.5 px-3 py-2 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3 [&:not(:last-child)]:border-b"
              >
                <span className="min-w-0">
                  <span className="font-medium">{plugin.name}</span>
                  <span className="ml-2 text-muted-foreground">{plugin.version || "Unknown version"}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {plugin.active ? "Active" : "Inactive"}
                  {plugin.update_available ? <span className="text-amber-800 dark:text-warning"> · Update available</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
