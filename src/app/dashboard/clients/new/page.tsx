import { CreateOrganizationForm } from "@/components/clients/create-organization-form";

export const metadata = {
  title: "Add Organization | KT-Portal",
  description: "Create a new client organization",
};

export default function NewClientPage() {
  return (
    <div className="container py-6">
      <CreateOrganizationForm />
    </div>
  );
}
