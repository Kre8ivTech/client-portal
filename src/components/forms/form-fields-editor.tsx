"use client";

import { useState } from "react";
import { updateFormFields, type FormFieldDef } from "@/lib/actions/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

const FIELD_TYPES = ["text", "email", "textarea"] as const;

export function FormFieldsEditor({
  formId,
  initialFields,
}: {
  formId: string;
  initialFields: FormFieldDef[];
}) {
  const [fields, setFields] = useState<FormFieldDef[]>(initialFields);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addField() {
    const id = `field_${Date.now()}`;
    setFields((prev) => [...prev, { id, type: "text", label: id, required: false }]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function updateField(index: number, patch: Partial<FormFieldDef>) {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await updateFormFields(formId, fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Form fields</h3>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <Plus className="h-4 w-4 mr-1" />
          Add field
        </Button>
      </div>
      <ul className="space-y-3">
        {fields.map((f, i) => (
          <li
            key={f.id}
            className="flex flex-wrap items-end gap-2 rounded-lg border p-3 bg-muted/30"
          >
            <div className="flex-1 min-w-[120px] space-y-1">
              <Label className="text-xs">ID</Label>
              <Input
                value={f.id}
                onChange={(e) => updateField(i, { id: e.target.value.replace(/\s/g, "_") })}
                placeholder="field_id"
                className="font-mono text-sm"
              />
            </div>
            <div className="flex-1 min-w-[120px] space-y-1">
              <Label className="text-xs">Label</Label>
              <Input
                value={f.label ?? ""}
                onChange={(e) => updateField(i, { label: e.target.value })}
                placeholder="Label"
              />
            </div>
            <div className="w-[120px] space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={f.type ?? "text"}
                onValueChange={(v) => updateField(i, { type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!f.required}
                onChange={(e) => updateField(i, { required: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Required</span>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeField(i)}
              aria-label="Remove field"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No fields. Add one to collect responses.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save fields"}
      </Button>
    </div>
  );
}
