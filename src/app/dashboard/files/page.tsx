import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FolderLock } from "lucide-react";
import { FilesPageClient } from "./files-page-client";

export default async function FilesPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userRow } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  type UserRow = { organization_id: string | null; role: string };
  const profile = userRow as UserRow | null;

  if (!profile?.organization_id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Files</h1>
          <p className="text-muted-foreground">
            Encrypted file storage for your organization.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              No organization found. You need an organization to use file
              storage.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const awsConfigured =
    !!process.env.AWS_S3_BUCKET_NAME &&
    !!process.env.AWS_ACCESS_KEY_ID &&
    !!process.env.AWS_SECRET_ACCESS_KEY;

  const isPrivileged =
    profile.role === "super_admin" || profile.role === "staff";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Files</h1>
        <p className="text-muted-foreground">
          {isPrivileged
            ? "Manage encrypted files across your organization."
            : "Your private, encrypted file storage."}
        </p>
      </div>

      {!awsConfigured && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-700">
              AWS S3 is not configured. Contact your administrator to enable
              file storage.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FolderLock className="text-primary w-5 h-5" />
            {isPrivileged ? "Organization Files" : "My Files"}
          </CardTitle>
          <CardDescription>
            {isPrivileged
              ? "All files uploaded by clients and staff in your organization. Each client's files are isolated in their own encrypted folder."
              : "Files in your private encrypted folder. Only you and your organization's administrators can access these files."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <FilesPageClient awsConfigured={awsConfigured} />
        </CardContent>
      </Card>
    </div>
  );
}
