import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Ticket, 
  FileText, 
  CreditCard,
  Clock,
  AlertCircle
} from "lucide-react";

interface InboxItem {
  id: string;
  type: 'message' | 'ticket' | 'invoice' | 'contract';
  title: string;
  description?: string;
  timestamp: string;
  status?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  unread?: boolean;
  href: string;
}

export async function DashboardInbox() {
  const supabase = (await createServerSupabaseClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  const organizationId = profile?.organization_id;
  if (!organizationId) return null;

  const inboxItems: InboxItem[] = [];

  // Fetch unread messages from conversations
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, subject, last_message_at, unread_count, participant_ids')
    .contains('participant_ids', [user.id])
    .gt('unread_count', 0)
    .order('last_message_at', { ascending: false })
    .limit(5);

  if (conversations) {
    conversations.forEach((conv: any) => {
      inboxItems.push({
        id: conv.id,
        type: 'message',
        title: conv.subject || 'New Message',
        description: `${conv.unread_count} unread message${conv.unread_count > 1 ? 's' : ''}`,
        timestamp: conv.last_message_at,
        unread: true,
        href: '/dashboard/messages',
      });
    });
  }

  // Fetch recent ticket comments (where user is the ticket creator)
  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      id,
      ticket_number,
      subject,
      status,
      priority,
      updated_at,
      created_by,
      ticket_comments!inner(created_at, author_id)
    `)
    .eq('organization_id', organizationId)
    .eq('created_by', user.id)
    .neq('ticket_comments.author_id', user.id)
    .in('status', ['new', 'open', 'in_progress', 'pending_client'])
    .order('updated_at', { ascending: false })
    .limit(5);

  if (tickets) {
    const uniqueTickets = new Map();
    tickets.forEach((ticket: any) => {
      if (!uniqueTickets.has(ticket.id)) {
        uniqueTickets.set(ticket.id, {
          id: ticket.id,
          type: 'ticket',
          title: `#${ticket.ticket_number}: ${ticket.subject}`,
          description: 'New response from support',
          timestamp: ticket.updated_at,
          status: ticket.status,
          priority: ticket.priority,
          unread: true,
          href: `/dashboard/tickets/${ticket.id}`,
        });
      }
    });
    inboxItems.push(...uniqueTickets.values());
  }

  // Fetch unpaid invoices
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_amount, due_date, status')
    .eq('organization_id', organizationId)
    .eq('status', 'sent')
    .order('due_date', { ascending: true })
    .limit(3);

  if (invoices) {
    invoices.forEach((invoice: any) => {
      const dueDate = new Date(invoice.due_date);
      const isOverdue = dueDate < new Date();
      
      inboxItems.push({
        id: invoice.id,
        type: 'invoice',
        title: `Invoice #${invoice.invoice_number}`,
        description: `$${invoice.total_amount.toFixed(2)} ${isOverdue ? 'overdue' : 'due'}`,
        timestamp: invoice.due_date,
        status: isOverdue ? 'overdue' : 'pending',
        priority: isOverdue ? 'high' : 'medium',
        href: `/dashboard/invoices/${invoice.id}`,
      });
    });
  }

  // Fetch pending contracts
  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, title, status, created_at')
    .eq('organization_id', organizationId)
    .in('status', ['draft', 'pending_signature'])
    .order('created_at', { ascending: false })
    .limit(3);

  if (contracts) {
    contracts.forEach((contract: any) => {
      inboxItems.push({
        id: contract.id,
        type: 'contract',
        title: contract.title,
        description: contract.status === 'pending_signature' ? 'Awaiting signature' : 'Draft contract',
        timestamp: contract.created_at,
        status: contract.status,
        href: `/dashboard/contracts/${contract.id}`,
      });
    });
  }

  // Sort all items by timestamp
  inboxItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Limit to top 10 items
  const topItems = inboxItems.slice(0, 10);

  const unreadCount = topItems.filter(item => item.unread).length;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Inbox</CardTitle>
            <CardDescription>Recent updates and notifications</CardDescription>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="rounded-full">
              {unreadCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {topItems.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">No new notifications</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {topItems.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                <Link
                  href={item.href}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                    item.unread ? 'bg-primary/10' : 'bg-muted'
                  } group-hover:bg-primary/20 transition-colors`}>
                    {item.type === 'message' && (
                      <MessageSquare className={`h-4 w-4 ${item.unread ? 'text-primary' : 'text-muted-foreground'}`} />
                    )}
                    {item.type === 'ticket' && (
                      <Ticket className={`h-4 w-4 ${item.unread ? 'text-primary' : 'text-muted-foreground'}`} />
                    )}
                    {item.type === 'invoice' && (
                      <CreditCard className={`h-4 w-4 ${item.status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}`} />
                    )}
                    {item.type === 'contract' && (
                      <FileText className={`h-4 w-4 text-muted-foreground`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm truncate ${item.unread ? 'font-semibold' : 'font-medium'}`}>
                        {item.title}
                      </p>
                      {item.priority === 'high' || item.priority === 'critical' || item.status === 'overdue' ? (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      ) : null}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                      </span>
                      {item.status && (
                        <Badge variant="outline" className="text-xs ml-auto">
                          {item.status.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {topItems.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/dashboard/messages"
                className="text-xs font-medium text-center py-2 rounded-md hover:bg-muted transition-colors"
              >
                View Messages
              </Link>
              <Link
                href="/dashboard/tickets"
                className="text-xs font-medium text-center py-2 rounded-md hover:bg-muted transition-colors"
              >
                View Tickets
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
