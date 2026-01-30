"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { createVaultItemSchema } from "@/lib/validators/vault";
import { revalidatePath } from "next/cache";

export async function createVaultItem(formData: FormData) {
  const supabase = (await createServerSupabaseClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  // Get current user profile to find organization_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id)
    throw new Error("No organization found for user");

  const result = createVaultItemSchema.safeParse({
    label: formData.get("label"),
    description: formData.get("description"),
    service_url: formData.get("service_url"),
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!result.success) {
    throw new Error("Validation failed");
  }

  const { label, description, service_url, username, password } = result.data;

  // Encrypt password before storage
  const { encryptedData, iv, authTag } = encrypt(password);

  const { error } = await supabase.from("vault_items").insert({
    organization_id: profile.organization_id,
    created_by: user.id,
    label,
    description,
    service_url,
    username,
    encrypted_password: encryptedData,
    iv,
    auth_tag: authTag,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/vault");
  return { success: true };
}

export async function getDecryptedPassword(itemId: string) {
  const supabase = (await createServerSupabaseClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { data: item, error } = await supabase
    .from("vault_items")
    .select("encrypted_password, iv, auth_tag")
    .eq("id", itemId)
    .single();

  if (error || !item) throw new Error("Vault item not found or hidden");

  // Decrypt on demand
  try {
    const password = decrypt(item.encrypted_password, item.iv, item.auth_tag);
    return { password };
  } catch (err) {
    throw new Error("Decryption failed. Ensure ENCRYPTION_SECRET is correct.");
  }
}

export async function deleteVaultItem(itemId: string) {
  const supabase = (await createServerSupabaseClient()) as any;
  const { error } = await supabase
    .from("vault_items")
    .delete()
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/vault");
  return { success: true };
}
