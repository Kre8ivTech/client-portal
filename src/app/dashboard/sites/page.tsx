import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
import { SiteMonitorForm } from "@/components/sites/site-monitor-form";
import { WordPressPluginDownload } from "@/components/sites/wordpress-plugin-download";
import { WordPressPluginStatus } from "@/components/sites/wordpress-plugin-status";
import { canOfferSiteMonitorForm, siteMonitorFormListsChildClientsOnly } from "@/lib/sites/site-monitor-access";
import { canDownloadWordPressPlugin } from "@/lib/sites/wordpress-plugin-package";

type Monitor = {
  id: string;
  name: string;
  url: string;
  status: string;
  uptime_percentage_30d: number | null;
  ssl_expiry_date: string | null;
  platform: string | null;
  wp_plugins: unknown;
  wp_plugins_updated_at: string | null;
  maintenance_window: string | null;
  care_notes: string | null;
  last_check_at: string | null;
  organizations?: { name?: string } | { name?: string }[] | null;
};

function orgName(value: Monitor["organizations"]) {
  if (Array.isArray(value)) return value[0]?.name || "";
  return value?.name || "";
}

export default async function SitesPage() {
  const { role, profile } = await requireRole(["super_admin", "staff", "partner", "partner_staff", "client"]);
  const supabase = await createServerSupabaseClient();
  const canAdd = canOfferSiteMonitorForm(role);
  const childClientsOnly = siteMonitorFormListsChildClientsOnly(role);
  const actorOrganizationId = profile?.organization_id ?? null;

  const organizationQuery =
    canAdd && childClientsOnly && actorOrganizationId
      ? supabase
          .from("organizations")
          .select("id, name")
          .eq("parent_org_id", actorOrganizationId)
          .eq("type", "client")
          .order("name")
      : canAdd && !childClientsOnly
        ? supabase.from("organizations").select("id, name").order("name").limit(200)
        : Promise.resolve({ data: [] as { id: string; name: string }[] });

  const [{ data: monitors }, orgs] = await Promise.all([
    supabase
      .from("site_monitors")
      .select(
        "id, name, url, status, uptime_percentage_30d, ssl_expiry_date, platform, wp_plugins, wp_plugins_updated_at, maintenance_window, care_notes, last_check_at, organizations(name)",
      )
      .order("name"),
    organizationQuery,
  ]);

  const sites = (monitors ?? []) as Monitor[];
  const organizations = ((orgs.data ?? []) as { id: string; name: string }[]).map((org) => ({ id: org.id, name: org.name }));

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Sites</h2>
        <p className="mt-1 text-muted-foreground">
          Uptime, SSL, platform, maintenance window, and WordPress plugin status for each site. Plugin status
          appears after the monitor plugin sends a heartbeat. A new site stays unknown until a check is
          recorded. Public incident notices are on{" "}
          <Link href="/status" className="underline">
            the status page
          </Link>
          .
        </p>
      </div>
      {canDownloadWordPressPlugin(role) ? <WordPressPluginDownload /> : null}
      {canAdd ? <SiteMonitorForm organizations={organizations} /> : null}
      {sites.length === 0 ? <p className="text-sm text-muted-foreground">No sites are listed yet.</p> : null}
      <ul className="grid gap-4 md:grid-cols-2">
        {sites.map((site) => (
          <li key={site.id} className="space-y-2 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{site.name}</h3>
                <a href={site.url} className="text-sm underline" target="_blank" rel="noreferrer">
                  {site.url}
                </a>
              </div>
              <span className="text-sm capitalize">{site.status}</span>
            </div>
            {orgName(site.organizations) ? <p className="text-xs text-muted-foreground">{orgName(site.organizations)}</p> : null}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">30-day uptime</dt>
                <dd>{site.uptime_percentage_30d != null ? `${site.uptime_percentage_30d}%` : "Not checked yet"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">SSL expires</dt>
                <dd>{site.ssl_expiry_date || "Unknown"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Platform</dt>
                <dd>{site.platform || "Not set"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Maintenance</dt>
                <dd>{site.maintenance_window || "Not set"}</dd>
              </div>
            </dl>
            <WordPressPluginStatus
              platform={site.platform}
              plugins={site.wp_plugins}
              updatedAt={site.wp_plugins_updated_at}
            />
            {site.care_notes ? <p className="text-sm">{site.care_notes}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
