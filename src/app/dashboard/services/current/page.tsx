import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Calendar, DollarSign, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export const metadata = {
  title: "Current Services | KT Portal",
  description: "Your active service subscriptions",
};

type ServiceRequest = {
  id: string;
  status: string;
  service_id: string | null;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  custom_rate: number | null;
  estimated_completion: string | null;
  created_at: string;
  updated_at: string;
  service: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    base_rate: number | null;
    rate_type: string | null;
    estimated_hours: number | null;
  } | null;
};

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
    case 'approved':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Active</Badge>;
    case 'in_progress':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">In Progress</Badge>;
    case 'completed':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
    case 'cancelled':
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default async function CurrentServicesPage() {
  const supabase = await createServerSupabaseClient();

  // Get user info
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    throw new Error("Profile not found");
  }

  // Fetch active service requests (approved or in_progress)
  let query = supabase
    .from("service_requests")
    .select(`
      *,
      service:services(id, name, description, category, base_rate, rate_type, estimated_hours)
    `)
    .in("status", ["approved", "in_progress"]);

  // Filter by organization
  if (profile.organization_id) {
    query = query.eq("organization_id", profile.organization_id);
  }

  // Clients only see their own
  if (profile.role === "client") {
    query = query.eq("requested_by", user.id);
  }

  query = query.order("created_at", { ascending: false });

  const { data: activeServices, error } = await query;

  if (error) {
    console.error("Error fetching current services:", error);
    throw new Error("Failed to load current services");
  }

  const services = (activeServices || []) as ServiceRequest[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Current Services</h1>
          <p className="text-slate-500 mt-1">
            Your active service subscriptions and ongoing work
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/dashboard/services">
            <Button variant="outline" size="sm">
              <Package className="h-4 w-4 mr-2" />
              Browse Services
            </Button>
          </Link>
          <Link href="/dashboard/service/new">
            <Button size="sm">
              <Package className="h-4 w-4 mr-2" />
              Request Service
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Services</CardDescription>
            <CardTitle className="text-3xl">
              {services.filter((s) => s.status === "approved" || s.status === "in_progress").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>In Progress</CardDescription>
            <CardTitle className="text-3xl">
              {services.filter((s) => s.status === "in_progress").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Recently Approved</CardDescription>
            <CardTitle className="text-3xl">
              {services.filter((s) => s.status === "approved").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Service List */}
      {services.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((serviceRequest) => {
            const service = serviceRequest.service;
            const rate = serviceRequest.custom_rate ?? service?.base_rate;

            return (
              <Card key={serviceRequest.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        {service?.name || "Unknown Service"}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {service?.category || "Uncategorized"}
                      </CardDescription>
                    </div>
                    {getStatusBadge(serviceRequest.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {service?.description && (
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {service.description}
                    </p>
                  )}

                  <div className="space-y-2 text-sm">
                    {rate && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <DollarSign className="h-4 w-4 text-slate-400" />
                        <span>
                          ${rate.toFixed(2)}
                          {service?.rate_type && ` / ${service.rate_type}`}
                        </span>
                      </div>
                    )}

                    {service?.estimated_hours && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span>{service.estimated_hours} hours estimated</span>
                      </div>
                    )}

                    {serviceRequest.estimated_completion && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>
                          Due{" "}
                          {new Date(serviceRequest.estimated_completion).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span className="text-xs">
                        Started{" "}
                        {formatDistanceToNow(new Date(serviceRequest.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>

                  {serviceRequest.notes && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {serviceRequest.notes}
                      </p>
                    </div>
                  )}

                  <Link href={`/dashboard/service/${serviceRequest.id}`}>
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              No active services
            </h3>
            <p className="text-slate-500 text-sm mb-4 text-center max-w-md">
              You don't have any active service subscriptions. Browse our service
              catalog to request a service.
            </p>
            <div className="flex gap-2">
              <Link href="/dashboard/services">
                <Button variant="outline">
                  <Package className="h-4 w-4 mr-2" />
                  Browse Services
                </Button>
              </Link>
              <Link href="/dashboard/service/new">
                <Button>
                  <Package className="h-4 w-4 mr-2" />
                  Request Service
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
