import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const BEARER_PREFIX = "Bearer ";

/**
 * Constant-time string compare for Authorization header values.
 */
function timingSafeEqualUtf8(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/** True when `CRON_SECRET` is set and Authorization matches Bearer (constant-time). */
function isValidCronBearer(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization") ?? "";
  return timingSafeEqualUtf8(authHeader, `${BEARER_PREFIX}${cronSecret}`);
}

/**
 * Authorize cron handlers: valid `Authorization: Bearer <CRON_SECRET>` or an authenticated
 * super_admin/admin session (manual trigger).
 *
 * If `CRON_SECRET` is unset or empty, Bearer alone is never accepted — only session auth
 * (prevents `Bearer undefined` matching when the env var is missing).
 */
export async function authorizeCronOrSuperAdmin(request: NextRequest): Promise<NextResponse | null> {
  if (isValidCronBearer(request)) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "super_admin" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

/**
 * Same as {@link authorizeCronOrSuperAdmin} but session fallback allows super_admin, admin, or staff
 * (e.g. SLA monitoring route).
 */
export async function authorizeCronOrStaffLike(request: NextRequest): Promise<NextResponse | null> {
  if (isValidCronBearer(request)) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  const role = (profile as { role?: string } | null)?.role;
  if (!["super_admin", "admin", "staff"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
