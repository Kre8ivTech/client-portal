import { NextRequest, NextResponse } from "next/server";
import { authorizeCronOrSuperAdmin } from "@/lib/api/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { materializeDueSchedules } from "@/lib/ai/run-workflow-schedules";

export async function GET(request: NextRequest) {
  const denied = await authorizeCronOrSuperAdmin(request);
  if (denied) return denied;

  try {
    const result = await materializeDueSchedules(getSupabaseAdmin(), new Date());
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, created: result.created });
  } catch (error) {
    console.error("[Cron] Agent workflow schedule error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
