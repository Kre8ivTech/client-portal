"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { triggerWebhooks } from "@/lib/zapier/webhooks";
import { createTicketSchema } from "@/lib/validators/ticket";
import { z } from "zod";

/**
 * Create a new ticket (server action with webhook support)
 */
export async function createTicket(data: z.infer<typeof createTicketSchema>) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return { success: false, error: "Organization not found" };
    }

    // Validate input
    const result = createTicketSchema.safeParse(data);
    if (!result.success) {
      return { success: false, error: result.error.flatten().fieldErrors };
    }

    // Insert ticket
    const { data: ticket, error } = await supabase
      .from("tickets")
      .insert({
        organization_id: userData.organization_id,
        created_by: user.id,
        subject: result.data.subject,
        description: result.data.description,
        priority: result.data.priority || "medium",
        category: result.data.category,
        status: "new",
        tags: [],
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Trigger webhook asynchronously
    triggerWebhooks("ticket.created", userData.organization_id, ticket);

    return { success: true, data: ticket };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create ticket" };
  }
}

/**
 * Update a ticket (server action with webhook support)
 */
export async function updateTicket(
  ticketId: string,
  updates: { status?: string; priority?: string; category?: string; subject?: string; description?: string }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return { success: false, error: "Organization not found" };
    }

    // Get current ticket to verify ownership
    const { data: currentTicket } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .eq("organization_id", userData.organization_id)
      .single();

    if (!currentTicket) {
      return { success: false, error: "Ticket not found" };
    }

    // Update ticket
    const { data: ticket, error } = await supabase
      .from("tickets")
      .update(updates)
      .eq("id", ticketId)
      .eq("organization_id", userData.organization_id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Trigger appropriate webhook based on status change
    if (updates.status === "closed" && currentTicket.status !== "closed") {
      triggerWebhooks("ticket.closed", userData.organization_id, ticket);
    } else {
      triggerWebhooks("ticket.updated", userData.organization_id, ticket);
    }

    return { success: true, data: ticket };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update ticket" };
  }
}

/**
 * Close a ticket with an optional resolution note
 */
export async function closeTicketWithNote(
  ticketId: string,
  options: { note?: string; isInternal?: boolean } = {}
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get user's profile to check role and organization
    const { data: userData } = await supabase
      .from("user_profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return { success: false, error: "Organization not found" };
    }

    // Check if user has permission to close tickets (staff or admin)
    const canClose =
      userData.role === "super_admin" ||
      userData.role === "staff" ||
      userData.role === "partner" ||
      userData.role === "partner_staff";

    if (!canClose) {
      return { success: false, error: "You do not have permission to close tickets" };
    }

    // Get current ticket to verify it exists and check status
    const { data: currentTicket } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (!currentTicket) {
      return { success: false, error: "Ticket not found" };
    }

    if (currentTicket.status === "closed") {
      return { success: false, error: "Ticket is already closed" };
    }

    // Update ticket status to closed
    const { data: ticket, error: updateError } = await supabase
      .from("tickets")
      .update({
        status: "closed",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .select()
      .single();

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Add resolution note as a comment if provided
    if (options.note?.trim()) {
      const { error: commentError } = await supabase.from("ticket_comments").insert({
        ticket_id: ticketId,
        author_id: user.id,
        content: `[Ticket Closed] ${options.note.trim()}`,
        is_internal: options.isInternal ?? false,
      });

      if (commentError) {
        console.error("Failed to add closing note:", commentError);
        // Don't fail the whole operation if comment fails
      }
    }

    // Trigger webhook for ticket closed
    triggerWebhooks("ticket.closed", userData.organization_id, ticket);

    return { success: true, data: ticket };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to close ticket" };
  }
}
