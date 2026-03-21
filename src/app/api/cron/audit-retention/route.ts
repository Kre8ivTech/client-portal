import { NextRequest, NextResponse } from "next/server";
import { authorizeCronOrSuperAdmin } from "@/lib/api/cron-auth";

const RETENTION_DAYS = 30;

/**
 * Deletes audit_logs older than RETENTION_DAYS.
 * Call via Vercel Cron (CRON_SECRET) or by a super_admin (manual).
 */
export async function GET(request: NextRequest) {
  const denied = await authorizeCronOrSuperAdmin(request);
  if (denied) return denied;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffIso = cutoff.toISOString();

  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("audit_logs")
    .delete()
    .lt("created_at", cutoffIso)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const deleted = Array.isArray(data) ? data.length : 0;
  return NextResponse.json({ deleted, cutoff: cutoffIso });
}
