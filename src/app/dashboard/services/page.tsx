import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ClientServiceList } from "@/components/services/client-service-list";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";
import Link from "next/link";
import { isMissingColumnError } from "@/lib/utils/error-handling";

export const metadata = {
  title: "Services | KT Portal",
  description: "Browse and request available services",
};

export default async function ServicesPage() {
  const supabase = await createServerSupabaseClient();

  // Get user info
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Fetch available services
  // RLS will automatically filter to show only:
  // - Active services in user's organization
  // - Global services (is_global = true) - when column exists
  // - Parent org services (if white-label client)
  const baseSelect = "id, name, description, category, base_rate, rate_type, estimated_hours, is_active, display_order";
  const selectWithGlobal = `${baseSelect}, is_global`;

  let { data: services, error } = await supabase
    .from("services")
    .select(selectWithGlobal)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  // Backwards-compat: if DB hasn't been migrated yet, retry without is_global.
  if (error && isMissingColumnError(error, "is_global")) {
    ({ data: services, error } = await supabase
      .from("services")
      .select(baseSelect)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false }));
    services = (services || []).map((s: any) => ({ ...s, is_global: false }));
  }

  if (error) {
    console.error("Error fetching services:", error);
    throw new Error("Failed to load services");
  }

  // Get user's service requests count
  const { count: requestsCount } = await supabase
    .from("service_requests")
    .select("*", { count: "exact", head: true })
    .eq("requested_by", user.id)
    .eq("status", "pending");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Available Services</h1>
          <p className="text-slate-500 mt-1">Browse and request services from our catalog</p>
        </div>

        <div className="flex items-center gap-3">
          {requestsCount !== null && requestsCount > 0 && (
            <Link href="/dashboard/service-requests">
              <Button variant="outline" size="sm">
                <Package className="h-4 w-4 mr-2" />
                My Requests ({requestsCount})
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Service List */}
      <ClientServiceList initialServices={services || []} />
    </div>
  );
}
