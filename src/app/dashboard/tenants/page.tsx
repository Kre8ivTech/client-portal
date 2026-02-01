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
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Building2, ExternalLink } from "lucide-react";

export default async function TenantsPage() {
  await requireRole(["super_admin"]);

  const supabase = await createServerSupabaseClient();
  const { data: orgsData } = await supabase
    .from("organizations")
    .select("id, name, slug, type, status, parent_org_id, created_at")
    .order("created_at", { ascending: false });

  type OrgRow = { id: string; name: string; slug: string; type: string; status: string; parent_org_id: string | null; created_at: string };
  const orgs = (orgsData ?? []) as OrgRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
        <p className="text-muted-foreground">
          View and manage all organizations (super admin only).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organizations
          </CardTitle>
          <CardDescription>
            All tenants in the system. Partner and client orgs can be managed from Clients when linked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgs.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-8 text-center text-muted-foreground">
              No organizations yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((org: OrgRow) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="font-mono text-sm">{org.slug}</TableCell>
                    <TableCell>
                      <Badge variant={org.type === "kre8ivtech" ? "default" : "secondary"}>
                        {org.type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          org.status === "active"
                            ? "default"
                            : org.status === "suspended"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {org.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(org.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/dashboard/clients/${org.id}`} aria-label="View">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
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
