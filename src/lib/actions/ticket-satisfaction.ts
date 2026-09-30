"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  ticketId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().default(""),
});

export async function submitTicketSatisfaction(input: z.input<typeof schema>) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message || "Choose a rating" };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Unauthorized" };

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, created_by, status, satisfaction_rating")
    .eq("id", parsed.data.ticketId)
    .maybeSingle();
  if (error || !ticket) return { success: false as const, error: "Ticket not found" };

  const row = ticket as { created_by: string; status: string; satisfaction_rating: number | null };
  if (row.created_by !== user.id) return { success: false as const, error: "Only the person who opened this ticket can rate it" };
  if (row.status !== "resolved" && row.status !== "closed") {
    return { success: false as const, error: "Rate the ticket after it is resolved" };
  }
  if (row.satisfaction_rating != null) return { success: false as const, error: "This ticket already has a rating" };

  const { error: updateError } = await supabase
    .from("tickets")
    .update({
      satisfaction_rating: parsed.data.rating,
      satisfaction_comment: parsed.data.comment || null,
    })
    .eq("id", parsed.data.ticketId);
  if (updateError) return { success: false as const, error: updateError.message };

  revalidatePath(`/dashboard/tickets/${parsed.data.ticketId}`);
  return { success: true as const };
}
