import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TicketList } from "@/components/tickets/ticket-list";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PlusCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function TicketsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[tickets] fetch error:", error.message, error.code, error.details);
    }
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
            <p className="text-slate-500">Manage your active and past support requests.</p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/dashboard/tickets/new">
              <PlusCircle className="h-4 w-4" />
              <span>New Support Ticket</span>
            </Link>
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load tickets</AlertTitle>
          <AlertDescription>
            Something went wrong loading your tickets. You can try creating a new ticket or
            refreshing the page. If this continues, contact support.
          </AlertDescription>
        </Alert>
        <TicketList initialTickets={[]} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
          <p className="text-slate-500">Manage your active and past support requests.</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/dashboard/tickets/new">
            <PlusCircle className="h-4 w-4" />
            <span>New Support Ticket</span>
          </Link>
        </Button>
      </div>

      <TicketList initialTickets={tickets || []} />
    </div>
  );
}
