import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
import { FormCreateForm } from "@/components/forms/form-create-form";
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
import { FileEdit, Plus, Inbox } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormStatusButton } from "@/components/forms/form-status-button";

export default async function FormsPage() {
  await requireRole(["super_admin", "staff"]);

  const supabase = await createServerSupabaseClient();
  const { data: forms } = await supabase
    .from("forms")
    .select("id, name, slug, status, created_at")
    .order("created_at", { ascending: false });

  const formIds = (forms ?? []).map((f: { id: string }) => f.id);
  const { data: submissionCounts } = formIds.length
    ? await supabase
        .from("form_submissions")
        .select("form_id")
        .in("form_id", formIds)
    : { data: [] };

  const countByForm: Record<string, number> = {};
  (submissionCounts ?? []).forEach((s: { form_id: string }) => {
    countByForm[s.form_id] = (countByForm[s.form_id] ?? 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Forms</h1>
        <p className="text-muted-foreground">
          Create and manage forms (admin/staff). All roles can submit.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileEdit className="h-5 w-5" />
                Forms
              </CardTitle>
              <CardDescription>
                Form builder and submissions. Set status to Active to allow submissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!forms?.length ? (
                <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-6 text-center text-muted-foreground text-sm">
                  No forms yet. Create one with the form.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submissions</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[120px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forms.map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell className="font-mono text-sm">{f.slug}</TableCell>
                        <TableCell>
                          <Badge variant={f.status === "active" ? "default" : "secondary"}>{f.status}</Badge>
                        </TableCell>
                        <TableCell>{countByForm[f.id] ?? 0}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(f.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="flex items-center gap-1">
                          <FormStatusButton formId={f.id} currentStatus={f.status} />
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/forms/${f.id}`}>View</Link>
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
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create Form
              </CardTitle>
              <CardDescription>
                Add a new form. You can add fields and set status later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormCreateForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
