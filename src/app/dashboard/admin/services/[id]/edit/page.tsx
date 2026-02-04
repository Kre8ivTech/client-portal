import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ServiceForm } from "@/components/services/service-form";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface EditServicePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditServicePage({ params }: EditServicePageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  // Check auth and role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Unauthorized</div>;
  }

  const { data: profile } = await supabase.from("users").select("organization_id, role").eq("id", user.id).single();

  if (!profile) {
    return <div>Profile not found</div>;
  }

  const p = profile as { organization_id: string | null; role: string };
  if (!["super_admin", "staff"].includes(p.role)) {
    return <div>Forbidden - Admin access required</div>;
  }

  // Fetch the service
  const serviceQuery = (supabase as any).from("services").select("*").eq("id", id);

<<<<<<< Updated upstream
  // Staff are scoped to their org; super admins can edit across orgs.
  if (p.role !== 'super_admin' && p.organization_id) {
    serviceQuery.eq('organization_id', p.organization_id)
=======
  if (p.organization_id) {
    serviceQuery.eq("organization_id", p.organization_id);
>>>>>>> Stashed changes
  }

  const { data: service, error } = await serviceQuery.single();

  if (error || !service) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/admin/services"
          className="inline-flex items-center text-sm text-slate-500 hover:text-primary mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Services
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Edit Service</h1>
        <p className="text-slate-500 mt-1">Update service details and pricing</p>
      </div>

      {/* Form */}
      <ServiceForm initialData={service} />
    </div>
  );
}
