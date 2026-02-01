import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCog } from "lucide-react";

export default async function UserManagementPage() {
  await requireRole(["super_admin", "staff"]);

  const supabase = await createServerSupabaseClient();
  type UserRow = { id: string; email: string; role: string; created_at: string };
  type ProfileDisplayRow = { id: string; name: string | null; avatar_url: string | null; organization_name: string | null; organization_slug: string | null };
  const [
    { data: usersData },
    { data: profilesData },
  ] = await Promise.all([
    supabase.from("users").select("id, email, role, created_at").order("email", { ascending: true }),
    supabase.from("user_profiles").select("id, name, avatar_url, organization_name, organization_slug"),
  ]);
  const usersList = (usersData ?? []) as UserRow[];
  const profilesList = (profilesData ?? []) as ProfileDisplayRow[];
  const profiles = usersList.map((u) => {
    const p = profilesList.find((x) => x.id === u.id);
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      created_at: u.created_at,
      name: p?.name ?? null,
      avatar_url: p?.avatar_url ?? null,
      organization_name: p?.organization_name ?? null,
      organization_slug: p?.organization_slug ?? null,
    };
  });

  type ProfileRow = {
    id: string;
    name: string | null;
    email: string;
    role: string;
    avatar_url: string | null;
    created_at: string;
    organization_name: string | null;
    organization_slug: string | null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          Manage staff and partners. Invite users and assign roles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Users
          </CardTitle>
          <CardDescription>
            {profiles?.length ?? 0} user(s). Super admins see all; staff see same-organization users. Role changes require DB update (see Settings).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!profiles?.length ? (
            <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-8 text-center text-muted-foreground">
              No users found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(profiles as ProfileRow[]).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={p.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {(p.name ?? p.email).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{p.name ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{p.email}</TableCell>
                    <TableCell>
                      <Badge variant={p.role === "super_admin" ? "default" : "secondary"}>
                        {p.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p.organization_name ?? p.organization_slug ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
