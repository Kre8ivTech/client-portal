import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { intakeSecretMatches, readIntakeSecret, websiteIntakeSchema } from "@/lib/intake/payload";
import { receiveWebsiteRequest } from "@/lib/intake/receive-request";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const expected = process.env.INTAKE_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "Website intake is not configured" }, { status: 503 });
  }

  const provided = readIntakeSecret(request.headers.get("x-intake-secret"), request.headers.get("authorization"));
  if (!intakeSecretMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body" }, { status: 400 });
  }

  const parsed = websiteIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
  }

  const result = await receiveWebsiteRequest(getSupabaseAdmin(), parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(
    { ticketId: result.ticketId, ticketNumber: result.ticketNumber, created: result.created, duplicate: result.duplicate },
    { status: result.created ? 201 : 200 },
  );
}
