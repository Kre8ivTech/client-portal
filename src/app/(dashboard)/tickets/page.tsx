import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TicketList } from "@/components/tickets/ticket-list";
import Link from "next/link";

export default async function TicketsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: tickets } = await supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Tickets
          </h2>
          <p className="text-slate-500">
            Manage support requests and track queue positions.
          </p>
        </div>
        <Link href="/dashboard/tickets/new">
          <Button className="gap-2">
            <Plus size={18} />
            Create Ticket
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Open Tickets" value="0" />
        <StatsCard title="Avg. Response" value="--" />
        <StatsCard title="Queue Position" value="--" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
           <h3 className="text-lg font-medium">Recent Tickets</h3>
        </div>
        <TicketList initialTickets={tickets || []} />
      </div>
    </div>
  );
}

function StatsCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
