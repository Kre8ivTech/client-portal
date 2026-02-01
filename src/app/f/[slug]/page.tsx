import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FormSubmitClient } from "@/components/forms/form-submit-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type FieldDef = { id: string; type?: string; label?: string; required?: boolean };

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: form } = await supabase
    .from("forms")
    .select("id, name, slug, description, fields, status")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!form) notFound();

  const formRow = form as { id: string; name: string; slug: string; description: string | null; fields: unknown; status: string };
  const fields = (Array.isArray(formRow.fields) ? formRow.fields : []) as FieldDef[];

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{formRow.name}</CardTitle>
          <CardDescription>{formRow.description ?? "Submit the form below."}</CardDescription>
        </CardHeader>
        <CardContent>
          <FormSubmitClient formId={formRow.id} fields={fields} />
          <p className="text-xs text-muted-foreground mt-4 text-center">
            <Link href="/dashboard" className="underline">Back to dashboard</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
