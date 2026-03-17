import { CreateOrganizationForm } from "@/components/clients/create-organization-form";
import { requireRole } from "@/lib/require-role";

export const metadata = {
  title: "Add Organization | KT-Portal",
  description: "Create a new client organization",
};

export default async function NewClientPage() {
  await requireRole(["super_admin", "staff"]);

  return (
    <div className="container py-6">
      <CreateOrganizationForm />
    </div>
  );
}
