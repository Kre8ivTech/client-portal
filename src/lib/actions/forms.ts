"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";

export type FormFieldDef = { id: string; type?: string; label?: string; required?: boolean };

export async function createForm(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  const role = (profile as { role?: string } | null)?.role;
  if (role !== "staff" && role !== "super_admin")
    throw new Error("Only staff and admin can create forms");

  const name = formData.get("name") as string;
  const slug = (formData.get("slug") as string)?.toLowerCase().replace(/\s+/g, "-") || name.toLowerCase().replace(/\s+/g, "-");
  const description = (formData.get("description") as string) || null;

  const { error } = await supabase.from("forms").insert({
    organization_id: (profile as { organization_id?: string } | null)?.organization_id ?? null,
    created_by: user.id,
    name,
    slug,
    description,
    fields: [],
    settings: {},
    status: "draft",
  });

  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: "form.create",
    entity_type: "form",
    entity_id: undefined,
    new_values: { name, slug, status: "draft" },
  });

  revalidatePath("/dashboard/forms");
  return { success: true };
}

export async function updateFormFields(formId: string, fields: FormFieldDef[]) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as { role?: string } | null)?.role;
  if (role !== "staff" && role !== "super_admin")
    throw new Error("Only staff and admin can edit form fields");

  const { error } = await (supabase as any)
    .from("forms")
    .update({ fields, updated_at: new Date().toISOString() })
    .eq("id", formId);

  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: "form.fields_update",
    entity_type: "form",
    entity_id: formId,
    new_values: { field_count: fields.length },
  });

  revalidatePath("/dashboard/forms");
  revalidatePath("/dashboard/forms/[id]", "page");
  return { success: true };
}

export async function updateFormStatus(formId: string, status: "draft" | "active" | "archived") {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as { role?: string } | null)?.role;
  if (role !== "staff" && role !== "super_admin")
    throw new Error("Only staff and admin can update forms");

  const { error } = await (supabase as any)
    .from("forms")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", formId);

  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: "form.status_update",
    entity_type: "form",
    entity_id: formId,
    new_values: { status },
  });

  revalidatePath("/dashboard/forms");
  revalidatePath("/dashboard/forms/[id]", "page");
  return { success: true };
}
