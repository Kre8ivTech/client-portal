"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { revalidatePath } from "next/cache";

export async function createVaultItem(formData: FormData) {
  const supabase = await createServerSupabaseClient();
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

  const label = formData.get("label") as string;
  const description = formData.get("description") as string;
  const service_url = formData.get("service_url") as string;
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

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
  const supabase = await createServerSupabaseClient();
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
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("vault_items")
    .delete()
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/vault");
  return { success: true };
}
