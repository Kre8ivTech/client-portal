import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

const configSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1).optional(), // Optional for updates
  environment: z.enum(["sandbox", "production"]),
});

/**
 * Save or update QuickBooks app configuration
 * POST /api/admin/quickbooks/config
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only super admins can configure QuickBooks" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = configSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { client_id, client_secret, environment } = validation.data;

    // Check if config already exists
    const { data: existingConfig } = await supabase
      .from("quickbooks_app_config")
      .select("id, client_secret")
      .is("organization_id", null)
      .single();

    if (existingConfig) {
      // Update existing config
      const updateData: any = {
        client_id,
        environment,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      // Only update client_secret if provided
      if (client_secret) {
        updateData.client_secret = client_secret;
      }

      const { error: updateError } = await supabase
        .from("quickbooks_app_config")
        .update(updateData)
        .eq("id", existingConfig.id);

      if (updateError) {
        console.error("Error updating QB config:", updateError);
        return NextResponse.json(
          { error: "Failed to update configuration" },
          { status: 500 }
        );
      }
    } else {
      // Create new config
      if (!client_secret) {
        return NextResponse.json(
          { error: "Client secret is required for new configuration" },
          { status: 400 }
        );
      }

      const { error: insertError } = await supabase
        .from("quickbooks_app_config")
        .insert({
          client_id,
          client_secret,
          environment,
          organization_id: null, // Global config
          created_by: user.id,
        });

      if (insertError) {
        console.error("Error creating QB config:", insertError);
        return NextResponse.json(
          { error: "Failed to save configuration" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Configuration saved successfully",
    });
  } catch (error) {
    console.error("Error saving QB app config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Delete QuickBooks app configuration
 * DELETE /api/admin/quickbooks/config
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only super admins can delete QuickBooks configuration" },
        { status: 403 }
      );
    }

    // Delete global config
    const { error: deleteError } = await supabase
      .from("quickbooks_app_config")
      .delete()
      .is("organization_id", null);

    if (deleteError) {
      console.error("Error deleting QB config:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete configuration" },
        { status: 500 }
      );
    }

    // Also disconnect all QuickBooks integrations since the app credentials are gone
    const { error: disconnectError } = await supabase
      .from("quickbooks_integrations")
      .delete()
      .not("id", "is", null); // Delete all

    if (disconnectError) {
      console.warn(
        "Warning: Failed to disconnect QB integrations:",
        disconnectError
      );
      // Don't fail the request, but log the warning
    }

    return NextResponse.json({
      success: true,
      message: "Configuration deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting QB app config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Get QuickBooks app configuration (for display purposes)
 * GET /api/admin/quickbooks/config
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only super admins can view QuickBooks configuration" },
        { status: 403 }
      );
    }

    // Fetch config (without exposing the secret)
    const { data: config } = await supabase
      .from("quickbooks_app_config")
      .select("id, client_id, environment, created_at, updated_at")
      .is("organization_id", null)
      .single();

    return NextResponse.json({
      config: config || null,
    });
  } catch (error) {
    console.error("Error fetching QB app config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
