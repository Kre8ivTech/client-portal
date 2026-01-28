import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TicketComments } from "@/components/tickets/ticket-comments";
import { TicketActions } from "@/components/tickets/ticket-actions";

interface TicketDetailPageProps {
  params: {
    id: string;
  };
}

export default async function TicketDetailPage({ params }: TicketDetailPageProps) {
  const supabase = await createServerSupabaseClient();
  
  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("*, created_by:profiles!tickets_created_by_fkey(name, avatar_url)")
    .eq("id", params.id)
    .single();

  if (error || !ticket) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{ticket.subject}</h1>
              <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                <span className="font-mono">#{ticket.ticket_number}</span>
                <span>•</span>
                <span>
                  Opened {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                </span>
                <span>•</span>
                <span>by {ticket.created_by?.name || 'Unknown'}</span>
              </div>
            </div>
            <Badge className="capitalize">{ticket.status.replace('_', ' ')}</Badge>
          </div>
          
          <div className="prose prose-slate max-w-none text-slate-700 whitespace-pre-wrap">
            {ticket.description}
          </div>
        </div>

        <TicketComments ticketId={ticket.id} />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
             <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent>
             <TicketActions ticketId={ticket.id} currentStatus={ticket.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 mb-1">Priority</p>
                <Badge variant="outline" className="capitalize">{ticket.priority}</Badge>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Queue Position</p>
                <p className="font-medium">#{ticket.queue_position || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Category</p>
                <p className="font-medium capitalize">{ticket.category.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Assigned To</p>
                <p className="font-medium">-</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
