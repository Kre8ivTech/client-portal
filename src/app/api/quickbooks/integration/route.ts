import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireQuickBooksManager } from "@/lib/quickbooks/access";
import { QUICKBOOKS_SAFE_SELECT } from "@/lib/quickbooks/connection";
import { toPublicQuickBooksIntegration } from "@/lib/quickbooks/tokens";

const patchSchema = z.object({
  auto_sync_enabled: z.boolean(),
});

export async function GET() {
  const access = await requireQuickBooksManager();
  if (!access.ok) return access.response;

  const { data, error } = await access.supabase
    .from("quickbooks_integrations")
    .select(QUICKBOOKS_SAFE_SELECT)
    .eq("organization_id", access.actor.organizationId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data ? toPublicQuickBooksIntegration(data as never) : null,
  });
}

export async function PATCH(request: NextRequest) {
  const access = await requireQuickBooksManager();
  if (!access.ok) return access.response;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await access.supabase
    .from("quickbooks_integrations")
    .update({ auto_sync_enabled: parsed.data.auto_sync_enabled })
    .eq("organization_id", access.actor.organizationId)
    .select(QUICKBOOKS_SAFE_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "QuickBooks is not connected" }, { status: 404 });
  }

  return NextResponse.json({ data: toPublicQuickBooksIntegration(data as never) });
}
