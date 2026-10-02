import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
import { SiteMonitorCard } from "@/components/sites/site-monitor-card";
import { SiteMonitorEmptyState } from "@/components/sites/site-monitor-empty";
import { SiteMonitorForm } from "@/components/sites/site-monitor-form";
import { WordPressPluginDownload } from "@/components/sites/wordpress-plugin-download";
import { canOfferSiteMonitorForm, siteMonitorFormListsChildClientsOnly } from "@/lib/sites/site-monitor-access";
import { compareSiteMonitors } from "@/lib/sites/site-monitor-display";
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

  const sites = ([...(monitors ?? [])] as Monitor[]).sort((a, b) => compareSiteMonitors(a, b));
  const organizations = ((orgs.data ?? []) as { id: string; name: string }[]).map((org) => ({ id: org.id, name: org.name }));

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Sites</h2>
        <p className="mt-1 text-muted-foreground">
          Uptime, SSL, platform, maintenance window, and WordPress plugin status for each site. Plugin status
          appears after the monitor plugin sends a heartbeat. Issues appear first. A new site stays unknown until a
          check is recorded. Public incident notices are on{" "}
          <Link href="/status" className="underline">
            the status page
          </Link>
          .
        </p>
      </div>
      {canDownloadWordPressPlugin(role) ? <WordPressPluginDownload /> : null}
      {canAdd ? <SiteMonitorForm organizations={organizations} /> : null}
      {sites.length === 0 ? (
        <SiteMonitorEmptyState />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {sites.map((site) => (
            <li key={site.id}>
              <SiteMonitorCard
                name={site.name}
                url={site.url}
                status={site.status}
                organizationName={orgName(site.organizations)}
                lastCheckAt={site.last_check_at}
                sslExpiryDate={site.ssl_expiry_date}
                uptimePercentage30d={site.uptime_percentage_30d}
                platform={site.platform}
                maintenanceWindow={site.maintenance_window}
                careNotes={site.care_notes}
                wpPlugins={site.wp_plugins}
                wpPluginsUpdatedAt={site.wp_plugins_updated_at}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
