import { redirect } from "next/navigation";
import { requireRole } from "@/lib/require-role";

export default async function AdminPage() {
  const { role } = await requireRole(["super_admin", "staff"]);

  redirect(
    role === "super_admin"
      ? "/dashboard/admin/error-logs"
      : "/dashboard/admin/ai-usage",
  );
}
