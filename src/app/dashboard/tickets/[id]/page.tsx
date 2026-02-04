import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TicketDetail } from "@/components/tickets/ticket-detail";
import { notFound } from "next/navigation";
import { generatePageMetadata, truncateDescription, stripHtml } from "@/lib/seo";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase.from("tickets").select("ticket_number, subject, description").eq("id", id).single();

  const ticket = data as { ticket_number: string; subject: string; description: string | null } | null;
  if (!ticket) {
    return generatePageMetadata({ title: "Ticket Not Found" });
  }

  const description = ticket.description
    ? truncateDescription(stripHtml(ticket.description))
    : `Support ticket ${ticket.ticket_number}`;

  return generatePageMetadata({
    title: `${ticket.ticket_number}: ${ticket.subject}`,
    description,
    noIndex: true,
  });
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  // Get current user and their profile
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = (await supabase
    .from("user_profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()) as any;

  // Fetch ticket with creator and assigned staff info
  const { data: ticketData, error } = await (supabase
    .from("tickets")
    .select("*, creator:user_profiles!tickets_created_by_fkey(id, name), assigned_staff:user_profiles!tickets_assigned_to_fkey(id, name), organization:organizations(id, name)")
    .eq("id", id)
    .single() as unknown as Promise<{ data: Record<string, unknown> | null; error: Error | null }>);

  if (error || !ticketData) {
    return notFound();
  }

  // Flatten the nested data structures
  type QueryResult = typeof ticketData & {
    creator: {
      id: string;
      name: string | null;
    } | null;
    assigned_staff: {
      id: string;
      name: string | null;
    } | null;
    organization: {
      id: string;
      name: string | null;
    } | null;
  };

  const ticketWithRelations = {
    ...ticketData,
    creator: (ticketData as QueryResult).creator,
    assigned_staff: (ticketData as QueryResult).assigned_staff,
    organization: (ticketData as QueryResult).organization,
  };

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: false });

  return (
    <TicketDetail
      ticket={ticketWithRelations as any}
      userId={user.id}
      userRole={profile?.role}
      deliverables={deliverables || []}
      organizationId={profile?.organization_id || (ticketData as any)?.organization_id}
    />
  );
}
