import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  WORDPRESS_PLUGIN_ZIP_NAME,
  buildWordPressPluginZip,
  wordpressPluginDownloadDecision,
  wordpressPluginSourceDir,
} from "@/lib/sites/wordpress-plugin-package";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UserRoleRow = {
  role: string | null;
};

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const userRow = userData as UserRoleRow | null;
    const decision = wordpressPluginDownloadDecision({
      userId: user.id,
      role: userRow?.role,
    });

    if (decision !== "allow") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const zip = buildWordPressPluginZip(wordpressPluginSourceDir());
    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${WORDPRESS_PLUGIN_ZIP_NAME}"`,
        "Content-Length": String(zip.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("WordPress plugin download failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
