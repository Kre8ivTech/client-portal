"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";

export async function createTimeEntry(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  type ProfileRow = { organization_id: string | null; role?: string };
  const profile = profileData as ProfileRow | null;

  if (!profile?.organization_id)
    throw new Error("No organization found for user");

  const role = profile.role;
  if (role !== "staff" && role !== "super_admin")
    throw new Error("Only staff and admin can log time");

  const description = formData.get("description") as string;
  const hoursStr = formData.get("hours") as string;
  const entryDate = formData.get("entry_date") as string;
  const ticketId = (formData.get("ticket_id") as string) || null;
  const billable = formData.get("billable") === "true" || formData.get("billable") === "on";

  const hours = parseFloat(hoursStr);
  if (isNaN(hours) || hours <= 0 || hours > 24)
    throw new Error("Hours must be between 0 and 24");

  const { error } = await (supabase as any).from("time_entries").insert({
    organization_id: profile.organization_id,
    profile_id: user.id,
    ticket_id: ticketId || null,
    description,
    hours,
    entry_date: entryDate || new Date().toISOString().slice(0, 10),
    billable,
  });

  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: "time_entry.create",
    entity_type: "time_entry",
    details: { description, hours, ticket_id: ticketId, billable },
  });

  revalidatePath("/dashboard/time");
  return { success: true };
}

export async function deleteTimeEntry(id: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: "time_entry.delete",
    entity_type: "time_entry",
    entity_id: id,
  });

  revalidatePath("/dashboard/time");
  return { success: true };
}
