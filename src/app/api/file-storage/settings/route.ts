import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const updateSettingsSchema = z.object({
  s3_prefix: z.string().trim().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userRow } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  const role = (userRow as { role?: string } | null)?.role ?? "client";
  const organizationId = (userRow as { organization_id?: string | null } | null)?.organization_id ?? null;

  if (!organizationId) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  if (role !== "super_admin" && role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = supabase as unknown as {
    from: (table: string) => {
      upsert: (data: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: Error | null }>;
    };
  };

  const payload: Record<string, unknown> = {
    organization_id: organizationId,
    updated_by: user.id,
  };
  if (typeof parsed.data.enabled === "boolean") payload.enabled = parsed.data.enabled;
  if (parsed.data.s3_prefix !== undefined) payload.s3_prefix = parsed.data.s3_prefix;

  // On first insert set created_by as well
  payload.created_by = user.id;

  const { error } = await db.from("organization_file_storage_settings").upsert(payload, {
    onConflict: "organization_id",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

