import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

const emailChangeSchema = z.object({
  newEmail: z.string().email("Invalid email address"),
  // Password is required for non-super-admin users, but super admins may be SSO-only.
  password: z.string().min(1, "Password is required for email change").optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Determine role (defaults to client if user row missing)
    const { data: userRow } = await (supabase as any)
      .from("users")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (userRow?.role ?? "client") as string;
    const isSuperAdmin = role === "super_admin";

    // Parse and validate request body
    const body = await request.json();
    const validation = emailChangeSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const newEmail = String(validation.data.newEmail).trim().toLowerCase();
    const password = validation.data.password;

    // Check if email is already in use
    const { data: existingUser } = await (supabase as any)
      .from("users")
      .select("id")
      .eq("email", newEmail)
      .maybeSingle();

    if (existingUser && existingUser.id !== user.id) {
      return NextResponse.json(
        { error: "Email address is already in use" },
        { status: 400 }
      );
    }

    if (isSuperAdmin) {
      // Super admins: update immediately (no verification email) and keep public.users in sync.
      const supabaseAdmin = getSupabaseAdmin();

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email: newEmail,
        email_confirm: true as any,
      });

      if (authUpdateError) {
        return NextResponse.json(
          { error: authUpdateError.message || "Failed to change email" },
          { status: 400 }
        );
      }

      const { error: userRowUpdateError } = await (supabaseAdmin as any)
        .from("users")
        .update({ email: newEmail })
        .eq("id", user.id);

      if (userRowUpdateError) {
        return NextResponse.json(
          { error: "Email updated in auth, but failed to sync user record" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Email updated successfully.",
      });
    }

    // Non-super-admin: require password confirmation and use secure email change (verification email).
    if (!password) {
      return NextResponse.json(
        { error: "Password is required for email change" },
        { status: 400 }
      );
    }

    // Verify password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (signInError) {
      return NextResponse.json(
        { error: "Password is incorrect" },
        { status: 400 }
      );
    }

    // Update email - Supabase will send verification email automatically
    const { error: updateError } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification email sent to new address. Please check your inbox.",
    });
  } catch (error) {
    console.error("Error changing email:", error);
    return NextResponse.json(
      { error: "Failed to change email" },
      { status: 500 }
    );
  }
}
