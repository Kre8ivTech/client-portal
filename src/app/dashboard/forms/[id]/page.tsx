import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/require-role";
import { notFound } from "next/navigation";
import Link from "next/link";
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
import { ChevronLeft, Inbox } from "lucide-react";
import { FormFieldsEditor } from "@/components/forms/form-fields-editor";
import type { FormFieldDef } from "@/lib/actions/forms";

export default async function FormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["super_admin", "staff"]);

  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: form } = await supabase
    .from("forms")
    .select("id, name, slug, description, status, fields, created_at")
    .eq("id", id)
    .single();

  if (!form) notFound();

  type FormRow = { id: string; name: string; slug: string; description: string | null; status: string; fields: unknown; created_at: string };
  const formRow = form as FormRow;
  const fields = (Array.isArray(formRow.fields) ? formRow.fields : []) as FormFieldDef[];

  const { data: submissions } = await supabase
    .from("form_submissions")
    .select("id, responses, status, submitted_at, user_id")
    .eq("form_id", id)
    .order("submitted_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/forms"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Forms
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{formRow.name}</h1>
        <p className="text-muted-foreground">
          {formRow.description ?? formRow.slug} · <Badge variant="secondary">{formRow.status}</Badge>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
          <CardDescription>
            Define fields shown on the public form. ID is used as the response key.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormFieldsEditor formId={formRow.id} initialFields={fields} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Submissions
          </CardTitle>
          <CardDescription>
            {(submissions ?? []).length} submission(s). Responses are stored as JSON.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!submissions?.length ? (
            <div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-6 text-center text-muted-foreground text-sm">
              No submissions yet. Set form status to Active and share the form link.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Submitter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responses (preview)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(s.submitted_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.user_id ? `${s.user_id.slice(0, 8)}…` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{s.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate font-mono text-xs">
                      {typeof s.responses === "object"
                        ? JSON.stringify(s.responses).slice(0, 80) + (JSON.stringify(s.responses).length > 80 ? "…" : "")
                        : String(s.responses)}
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
