"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";

export async function updateProfile(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const name = (formData.get("name") as string)?.trim() ?? "";
  const avatarUrl = (formData.get("avatar_url") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const sameAsBusiness = formData.get("same_as_business") === "true";

  // Extract business address
  const businessAddress = {
    street: (formData.get("business_street") as string)?.trim() || null,
    city: (formData.get("business_city") as string)?.trim() || null,
    state: (formData.get("business_state") as string)?.trim() || null,
    zip: (formData.get("business_zip") as string)?.trim() || null,
    country: (formData.get("business_country") as string)?.trim() || null,
  };

  // Extract mailing address
  let mailingAddress;
  if (sameAsBusiness) {
    mailingAddress = businessAddress;
  } else {
    mailingAddress = {
      street: (formData.get("mailing_street") as string)?.trim() || null,
      city: (formData.get("mailing_city") as string)?.trim() || null,
      state: (formData.get("mailing_state") as string)?.trim() || null,
      zip: (formData.get("mailing_zip") as string)?.trim() || null,
      country: (formData.get("mailing_country") as string)?.trim() || null,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const updates: any = {
    name,
    phone: phone || null,
    business_address: businessAddress,
    mailing_address: mailingAddress,
    updated_at: new Date().toISOString(),
  };
  if (avatarUrl !== undefined && avatarUrl !== "") {
    updates.avatar_url = avatarUrl;
  }

  const { error } = await (supabase as any).from("profiles").update(updates).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  await writeAuditLog({
    action: "profile.update",
    entity_type: "profile",
    entity_id: user.id,
    new_values: {
      name,
      phone: !!phone,
      business_address: !!businessAddress.street,
      mailing_address: !!mailingAddress.street,
      avatar_url: avatarUrl !== undefined,
    },
  });

  revalidatePath("/dashboard/profile");
}

export async function updateAvatar(avatarUrl: string) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { error } = await (supabase as any)
    .from("profiles")
    .update({ 
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  await writeAuditLog({
    action: "profile.update",
    entity_type: "profile",
    entity_id: user.id,
    new_values: { avatar_url: avatarUrl },
  });

  revalidatePath("/dashboard/profile");
}
