"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { convertChatToTicket } from "@/lib/actions/convert-chat";

export type ChatQueueItem = {
  id: string;
  status: string;
  visitor_name: string | null;
  visitor_email: string | null;
  converted_ticket_id: string | null;
  started_at: string | null;
  created_at?: string | null;
};

export function ChatQueue({ chats }: { chats: ChatQueueItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div aria-live="polite" className="min-h-6 text-sm">
        {error ? <p className="text-destructive">{error}</p> : null}
        {message ? <p>{message}</p> : null}
      </div>
      {chats.length === 0 ? <p className="text-sm text-muted-foreground">No chats yet.</p> : null}
      <ul className="space-y-3">
        {chats.map((chat) => (
          <li key={chat.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
            <div>
              <p className="font-medium">{chat.visitor_name || "Website visitor"}</p>
              <p className="text-sm text-muted-foreground">{chat.visitor_email || "No email"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{chat.status}</Badge>
              {chat.converted_ticket_id ? (
                <Link href={`/dashboard/tickets/${chat.converted_ticket_id}`} className="text-sm underline">
                  Open ticket
                </Link>
              ) : (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await convertChatToTicket(chat.id);
                      if (!result.success) {
                        setError(result.error);
                        setMessage(null);
                        return;
                      }
                      setError(null);
                      setMessage(result.created ? "Ticket created from the chat" : "This chat already has a ticket");
                      router.refresh();
                    });
                  }}
                >
                  Create ticket
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
