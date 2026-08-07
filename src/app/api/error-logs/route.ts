import { NextRequest, NextResponse } from "next/server";
import { redactDiagnosticText, sanitizeErrorRoute } from "@/lib/error-logs";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { errorLogSchema } from "@/lib/validators/error-log";

const MAX_REQUEST_BYTES = 32_768;

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.arrayBuffer();
    if (rawBody.byteLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const body: unknown = (() => {
      try {
        return JSON.parse(new TextDecoder().decode(rawBody));
      } catch {
        return null;
      }
    })();
    const parsed = errorLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid error log payload" }, { status: 400 });
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (userError || !userRow) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const { context } = parsed.data;
    const admin = getSupabaseAdmin();
    const { error: insertError } = await admin.from("error_logs").insert({
      organization_id: (userRow as { organization_id: string | null }).organization_id,
      user_id: user.id,
      severity: "error",
      source: parsed.data.source,
      message: redactDiagnosticText(parsed.data.message, 2_000),
      stack_trace: redactDiagnosticText(parsed.data.stack, 12_000),
      digest: redactDiagnosticText(parsed.data.digest, 255),
      route: sanitizeErrorRoute(parsed.data.route),
      user_agent: redactDiagnosticText(request.headers.get("user-agent"), 1_000),
      environment: redactDiagnosticText(process.env.VERCEL_ENV ?? process.env.NODE_ENV, 100),
      release: redactDiagnosticText(process.env.VERCEL_GIT_COMMIT_SHA, 255),
      context: {
        ...(context?.filename
          ? { filename: sanitizeErrorRoute(context.filename) ?? undefined }
          : {}),
        ...(context?.line !== undefined ? { line: context.line } : {}),
        ...(context?.column !== undefined ? { column: context.column } : {}),
      },
    });

    if (insertError) {
      console.error("[ErrorLog] Failed to record error", {
        code: insertError.code,
        details: insertError.details,
      });

      const isMissingTable = insertError.code === "42P01" || insertError.code === "PGRST205";
      return NextResponse.json(
        {
          error: isMissingTable
            ? "Error logging is not configured"
            : "Failed to record error",
        },
        { status: isMissingTable ? 503 : 500 },
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
