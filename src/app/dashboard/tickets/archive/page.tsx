import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TicketList } from "@/components/tickets/ticket-list";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, Archive } from "lucide-react";
import Link from "next/link";

export default async function TicketsArchivePage() {
  const supabase = await createServerSupabaseClient();

  // Get current user to check if they're staff
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch archived tickets (resolved, closed, cancelled) - simplified query
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("*")
    .in("status", ["resolved", "closed", "cancelled"])
    .order("updated_at", { ascending: false });

  // Fetch organizations for filter (only for staff/admins)
  let organizations: Array<{ id: string; name: string }> = [];
  if (user) {
    const { data: userProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userProfile?.role === "staff" || userProfile?.role === "super_admin") {
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      organizations = orgs || [];
    }
  }

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[tickets/archive] fetch error:", error.message, error.code, error.details);
    }
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/tickets">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tickets
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-slate-500" />
                <h1 className="text-2xl font-bold tracking-tight">Ticket Archive</h1>
              </div>
              <p className="text-slate-500 mt-1">View resolved, closed, and cancelled tickets for audit purposes.</p>
            </div>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load archived tickets</AlertTitle>
          <AlertDescription>
            Something went wrong loading the ticket archive. Please try refreshing the page.
            If this continues, contact support.
          </AlertDescription>
        </Alert>
        <TicketList initialTickets={[]} organizations={organizations} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/tickets">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tickets
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-slate-500" />
              <h1 className="text-2xl font-bold tracking-tight">Ticket Archive</h1>
            </div>
            <p className="text-slate-500 mt-1">
              {tickets && tickets.length > 0
                ? `Viewing ${tickets.length} archived ticket${tickets.length !== 1 ? 's' : ''}`
                : 'No archived tickets found'}
            </p>
          </div>
        </div>
      </div>

      {tickets && tickets.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-12 text-center">
          <Archive className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Archived Tickets</h3>
          <p className="text-slate-600 mb-6">
            There are no resolved, closed, or cancelled tickets in the archive yet.
          </p>
          <Button asChild>
            <Link href="/dashboard/tickets">
              View Active Tickets
            </Link>
          </Button>
        </div>
      ) : (
        <TicketList initialTickets={tickets || []} organizations={organizations} />
      )}
    </div>
  );
}
