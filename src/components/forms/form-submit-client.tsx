"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitForm } from "@/lib/actions/form-submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FieldDef = { id: string; type?: string; label?: string; required?: boolean };

export function FormSubmitClient({ formId, fields }: { formId: string; fields: FieldDef[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = e.currentTarget;
    const responses: Record<string, string | string[]> = {};
    fields.forEach((f) => {
      const el = form.elements.namedItem(f.id);
      if (el && "value" in el) {
        const val = (el as HTMLInputElement | HTMLTextAreaElement).value;
        if (el instanceof HTMLInputElement && el.type === "checkbox" && el.name.endsWith("[]")) {
          const name = el.name.replace("[]", "");
          if (!responses[name]) responses[name] = [];
          if (Array.isArray(responses[name])) (responses[name] as string[]).push(val);
        } else {
          responses[f.id] = val;
        }
      }
    });
    try {
      await submitForm(formId, responses);
      setSuccess(true);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 text-center">
        <p className="font-medium text-green-800 dark:text-green-200">Thank you. Your response has been submitted.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((f) => (
        <div key={f.id} className="space-y-2">
          <Label htmlFor={f.id}>
            {f.label ?? f.id}
            {f.required && <span className="text-destructive"> *</span>}
          </Label>
          {f.type === "textarea" ? (
            <Textarea id={f.id} name={f.id} required={f.required} rows={3} />
          ) : (
            <Input
              id={f.id}
              name={f.id}
              type={f.type === "email" ? "email" : "text"}
              required={f.required}
            />
          )}
        </div>
      ))}
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No fields defined. Add fields in the form editor.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={submitting || fields.length === 0}>
        {submitting ? "Submitting…" : "Submit"}
      </Button>
    </form>
  );
}
