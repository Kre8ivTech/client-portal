import Link from "next/link";
import { requireRole } from "@/lib/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ChatQueue, type ChatQueueItem } from "@/components/support/chat-queue";

export default async function LiveChatsPage() {
  await requireRole(["super_admin", "staff", "partner", "partner_staff"]);
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("chat_sessions")
    .select("id, status, visitor_name, visitor_email, converted_ticket_id, started_at, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  const chats: ChatQueueItem[] = ((data ?? []) as ChatQueueItem[]).map((chat) => ({
    id: chat.id,
    status: chat.status,
    visitor_name: chat.visitor_name,
    visitor_email: chat.visitor_email,
    converted_ticket_id: chat.converted_ticket_id,
    started_at: chat.started_at || chat.created_at || null,
  }));

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Live chats</h2>
        <p className="mt-1 text-muted-foreground">
          Turn a chat that needs follow-up into a ticket. Open tickets stay on the{" "}
          <Link href="/dashboard/tickets" className="underline">
            ticket list
          </Link>
          .
        </p>
      </div>
      <ChatQueue chats={chats} />
    </div>
  );
}
