import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { WordPressPluginStatus } from "@/components/sites/wordpress-plugin-status";
import { parseMonitorDate, siteStatusLabel, sslState, type SslState } from "@/lib/sites/site-monitor-display";
import { cn } from "@/lib/utils";

export type SiteMonitorCardProps = {
  name: string;
  url: string;
  status: string;
  organizationName?: string | null;
  lastCheckAt?: string | null;
  sslExpiryDate?: string | null;
  uptimePercentage30d?: number | null;
  responseTimeMs?: number | null;
  performanceScore?: number | null;
  platform?: string | null;
  maintenanceWindow?: string | null;
  careNotes?: string | null;
  wpPlugins?: unknown;
  wpPluginsUpdatedAt?: string | null;
};

type Tone = "default" | "warning" | "danger" | "muted";

const toneClass: Record<Tone, string> = {
  default: "text-foreground",
  warning: "text-amber-800 dark:text-warning",
  danger: "text-destructive",
  muted: "text-muted-foreground",
};

const statusVariant = {
  up: "success",
  down: "destructive",
  degraded: "warning",
  unknown: "secondary",
} as const;

const railClass = {
  up: "bg-success",
  down: "bg-destructive",
  degraded: "bg-warning",
  unknown: "bg-muted-foreground/40",
} as const;

function knownStatus(status: string): keyof typeof statusVariant {
  if (status === "up" || status === "down" || status === "degraded") return status;
  return "unknown";
}

function formatWhen(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = parseMonitorDate(value);
  if (!parsed) return null;
  return formatDistanceToNow(parsed, { addSuffix: true });
}

function formatSslDate(value: string): string | null {
  const parsed = parseMonitorDate(value);
  if (!parsed) return null;
  return format(parsed, "MMM d, yyyy");
}

function sslCopy(state: SslState): { value: string; tone: Tone } {
  switch (state) {
    case "valid":
      return { value: "Valid", tone: "default" };
    case "expiring_soon":
      return { value: "Expiring", tone: "warning" };
    case "expired":
      return { value: "Expired", tone: "danger" };
    default:
      return { value: "Unknown", tone: "muted" };
  }
}

function asNumber(value: number): number {
  return typeof value === "number" ? value : Number(value);
}

function uptimeTone(value: number): Tone {
  const numeric = asNumber(value);
  if (!Number.isFinite(numeric) || numeric < 99) return "danger";
  if (numeric < 99.9) return "warning";
  return "default";
}

function responseTone(value: number): Tone {
  if (value > 2000) return "danger";
  if (value > 1000) return "warning";
  return "default";
}

function performanceTone(value: number): Tone {
  if (value < 50) return "danger";
  if (value < 90) return "warning";
  return "default";
}

function formatUptime(value: number): string {
  const numeric = asNumber(value);
  if (!Number.isFinite(numeric)) return "Not checked yet";
  return Number.isInteger(numeric) ? `${numeric}%` : `${numeric.toFixed(2)}%`;
}

type Metric = {
  label: string;
  value: string;
  tone: Tone;
  detail?: string | null;
};

function buildMetrics(props: SiteMonitorCardProps): Metric[] {
  const lastCheck = formatWhen(props.lastCheckAt);
  const heartbeat = formatWhen(props.wpPluginsUpdatedAt);
  const timingLabel = lastCheck ? "Last check" : heartbeat ? "Last heartbeat" : "Last check";
  const ssl = sslCopy(sslState(props.sslExpiryDate));
  const sslDetail = props.sslExpiryDate ? formatSslDate(props.sslExpiryDate) : null;

  const metrics: Metric[] = [
    {
      label: timingLabel,
      value: lastCheck ?? heartbeat ?? "Not recorded",
      tone: lastCheck || heartbeat ? "default" : "muted",
    },
    {
      label: "SSL",
      value: ssl.value,
      tone: ssl.tone,
      detail: sslDetail,
    },
  ];

  if (props.uptimePercentage30d !== undefined) {
    metrics.push(
      props.uptimePercentage30d == null
        ? { label: "30-day uptime", value: "Not checked yet", tone: "muted" }
        : {
            label: "30-day uptime",
            value: formatUptime(props.uptimePercentage30d),
            tone: uptimeTone(props.uptimePercentage30d),
          },
    );
  }

  if (props.responseTimeMs !== undefined) {
    metrics.push(
      props.responseTimeMs == null
        ? { label: "Response", value: "—", tone: "muted" }
        : { label: "Response", value: `${props.responseTimeMs}ms`, tone: responseTone(props.responseTimeMs) },
    );
  }

  if (props.performanceScore != null) {
    metrics.push({
      label: "Performance",
      value: `${props.performanceScore}/100`,
      tone: performanceTone(props.performanceScore),
    });
  }

  if (props.platform) {
    metrics.push({ label: "Platform", value: props.platform, tone: "default" });
  }

  return metrics;
}

export function SiteMonitorCard(props: SiteMonitorCardProps) {
  const status = knownStatus(props.status);
  const label = siteStatusLabel(status);
  const metrics = buildMetrics(props);
  const organization = props.organizationName?.trim();

  return (
    <article
      aria-label={`${props.name}, ${label}`}
      className="flex overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm [content-visibility:auto] [contain-intrinsic-size:auto_18rem]"
    >
      <div className={cn("w-1 shrink-0", railClass[status])} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-pretty">{props.name}</h3>
            <a
              href={props.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center break-all text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {props.url}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            {organization ? <p className="text-sm text-muted-foreground">{organization}</p> : null}
          </div>
          <Badge variant={statusVariant[status]} className="order-first w-fit gap-1.5 md:order-none">
            <span className="size-2 rounded-full bg-current" aria-hidden="true" />
            {label}
          </Badge>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{metric.label}</dt>
              <dd className={cn("mt-0.5 text-sm font-medium tabular-nums", toneClass[metric.tone])}>{metric.value}</dd>
              {metric.detail ? <p className="text-xs text-muted-foreground">{metric.detail}</p> : null}
            </div>
          ))}
        </dl>

        <WordPressPluginStatus
          platform={props.platform ?? null}
          plugins={props.wpPlugins}
          updatedAt={props.wpPluginsUpdatedAt ?? null}
        />

        {props.maintenanceWindow ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Maintenance </span>
            {props.maintenanceWindow}
          </p>
        ) : null}
        {props.careNotes ? <p className="text-pretty text-sm">{props.careNotes}</p> : null}
      </div>
    </article>
  );
}
