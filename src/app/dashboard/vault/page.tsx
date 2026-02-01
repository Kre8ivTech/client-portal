import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VaultList } from "@/components/vault/vault-list";
import { VaultCreateForm } from "@/components/vault/vault-create-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function VaultPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  type ProfileRow = { organization_id: string | null };
  const profile = profileData as ProfileRow | null;

  if (!profile?.organization_id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Secure Vault</h1>
          <p className="text-muted-foreground">Store and manage credentials securely.</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No organization found. You need an organization to use the vault.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: items } = await supabase
    .from("vault_items")
    .select("id, label, description, service_url, username, created_at")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Secure Vault</h1>
          <p className="text-muted-foreground">Store and manage credentials securely.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Stored Items</CardTitle>
              <CardDescription>Encrypted credentials for your organization.</CardDescription>
            </CardHeader>
            <CardContent>
              <VaultList items={items ?? []} />
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Add Item</CardTitle>
              <CardDescription>Create a new vault entry. Password is encrypted at rest.</CardDescription>
            </CardHeader>
            <CardContent>
              <VaultCreateForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
