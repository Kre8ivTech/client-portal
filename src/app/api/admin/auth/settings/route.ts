import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabaseClient } from "@/lib/supabase/server"

const APP_SETTINGS_ID = "00000000-0000-0000-0000-000000000001"

const updateAuthSettingsSchema = z.object({
  sso_google_enabled: z.boolean(),
  sso_microsoft_enabled: z.boolean(),
  sso_github_enabled: z.boolean(),
  sso_apple_enabled: z.boolean(),
  recaptcha_enabled: z.boolean(),
  recaptcha_site_key: z.string().trim().max(500).nullable().optional(),
  recaptcha_secret_key: z.string().trim().max(500).optional(),
  mfa_enabled: z.boolean(),
  mfa_required_for_staff: z.boolean(),
  mfa_required_for_clients: z.boolean(),
})

async function requireSuperAdmin() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: roleRow, error: roleError } = await (supabase as any)
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (roleError || roleRow?.role !== "super_admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { supabase }
}

export async function GET() {
  try {
    const gate = await requireSuperAdmin()
    if (gate.error) return gate.error

    const { data, error } = await (gate.supabase as any)
      .from("app_settings")
      .select(
        `
        sso_google_enabled,
        sso_microsoft_enabled,
        sso_github_enabled,
        sso_apple_enabled,
        recaptcha_enabled,
        recaptcha_site_key,
        recaptcha_secret_key,
        mfa_enabled,
        mfa_required_for_staff,
        mfa_required_for_clients
      `
      )
      .eq("id", APP_SETTINGS_ID)
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to load auth settings" }, { status: 500 })
    }

    return NextResponse.json({
      settings: {
        sso_google_enabled: data?.sso_google_enabled ?? false,
        sso_microsoft_enabled: data?.sso_microsoft_enabled ?? false,
        sso_github_enabled: data?.sso_github_enabled ?? false,
        sso_apple_enabled: data?.sso_apple_enabled ?? false,
        recaptcha_enabled: data?.recaptcha_enabled ?? false,
        recaptcha_site_key: data?.recaptcha_site_key ?? "",
        recaptcha_secret_configured: Boolean(data?.recaptcha_secret_key),
        mfa_enabled: data?.mfa_enabled ?? true,
        mfa_required_for_staff: data?.mfa_required_for_staff ?? false,
        mfa_required_for_clients: data?.mfa_required_for_clients ?? false,
      },
    })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin()
    if (gate.error) return gate.error

    const body = await request.json()
    const parsed = updateAuthSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
    }

    const payload = parsed.data

    if (payload.recaptcha_enabled && !payload.recaptcha_site_key) {
      return NextResponse.json(
        { error: "reCAPTCHA site key is required when reCAPTCHA is enabled" },
        { status: 400 }
      )
    }

    // Keep existing secret unless a non-empty replacement is provided.
    const updateData: Record<string, unknown> = {
      sso_google_enabled: payload.sso_google_enabled,
      sso_microsoft_enabled: payload.sso_microsoft_enabled,
      sso_github_enabled: payload.sso_github_enabled,
      sso_apple_enabled: payload.sso_apple_enabled,
      recaptcha_enabled: payload.recaptcha_enabled,
      recaptcha_site_key: payload.recaptcha_site_key || null,
      mfa_enabled: payload.mfa_enabled,
      mfa_required_for_staff: payload.mfa_required_for_staff,
      mfa_required_for_clients: payload.mfa_required_for_clients,
    }

    if (typeof payload.recaptcha_secret_key === "string" && payload.recaptcha_secret_key.length > 0) {
      updateData.recaptcha_secret_key = payload.recaptcha_secret_key
    }

    if (payload.mfa_required_for_staff || payload.mfa_required_for_clients) {
      updateData.mfa_enabled = true
    }

    const { error } = await (gate.supabase as any)
      .from("app_settings")
      .update(updateData)
      .eq("id", APP_SETTINGS_ID)

    if (error) {
      return NextResponse.json({ error: "Failed to save auth settings" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
