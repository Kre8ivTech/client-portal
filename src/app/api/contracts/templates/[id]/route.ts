import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { templateUpdateSchema } from "@/lib/validators/contract-template";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * Check if user has access to the template
 */
async function checkTemplateAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  templateId: string
): Promise<{ canView: boolean; canEdit: boolean; role: string; userOrgId: string | null }> {
  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", userId)
    .single();

  type ProfileRow = { organization_id: string | null; role: string };
  const prof = profile as ProfileRow | null;
  const role = prof?.role ?? "client";
  const userOrgId = prof?.organization_id ?? null;

  // Get the template
  const { data: template } = await supabase
    .from("contract_templates")
    .select("organization_id")
    .eq("id", templateId)
    .single();

  type TemplateRow = { organization_id: string | null };
  const templateData = template as TemplateRow | null;

  if (!templateData) {
    return { canView: false, canEdit: false, role, userOrgId };
  }

  // Super admins and staff can view/edit all templates
  if (role === "super_admin" || role === "staff") {
    return { canView: true, canEdit: true, role, userOrgId };
  }

  // Global templates (organization_id = null) can be viewed by all authenticated users
  if (templateData.organization_id === null) {
    return { canView: true, canEdit: false, role, userOrgId };
  }

  // Check if this template belongs to user's organization
  if (userOrgId === templateData.organization_id) {
    return { canView: true, canEdit: false, role, userOrgId };
  }

  return { canView: false, canEdit: false, role, userOrgId };
}

/**
 * GET /api/contracts/templates/[id]
 * Get a single contract template by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: templateId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await checkTemplateAccess(supabase, user.id, templateId);

    if (!access.canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the template
    const { data: template, error } = await supabase
      .from("contract_templates")
      .select("id, name, description, contract_type, template_content, variables, organization_id, created_by, is_active, created_at, updated_at")
      .eq("id", templateId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        ...(template as Record<string, unknown>),
        can_edit: access.canEdit,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/contracts/templates/[id]
 * Update a contract template
 * Only super_admin and staff can update templates
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: templateId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await checkTemplateAccess(supabase, user.id, templateId);

    if (!access.canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const result = templateUpdateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const input = result.data;

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.template_content !== undefined) updateData.template_content = input.template_content;
    if (input.variables !== undefined) updateData.variables = input.variables;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    // Update the template
    const { data: template, error } = await (supabase as any)
      .from("contract_templates")
      .update(updateData)
      .eq("id", templateId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: template });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contracts/templates/[id]
 * Soft delete a contract template (set is_active = false)
 * Only super_admin and staff can delete templates
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: templateId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await checkTemplateAccess(supabase, user.id, templateId);

    if (!access.canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify template exists
    const { data: existingTemplate, error: fetchError } = await supabase
      .from("contract_templates")
      .select("id, is_active")
      .eq("id", templateId)
      .single();

    if (fetchError || !existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Soft delete - set is_active to false
    const { data: template, error } = await (supabase as any)
      .from("contract_templates")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: template,
      message: "Template has been deactivated",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
