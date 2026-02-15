"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConversationList } from "@/components/messaging/conversation-list";
import { MessageThread } from "@/components/messaging/message-thread";
import { NewConversationDialog } from "@/components/messaging/new-conversation-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, PenSquare } from "lucide-react";
import type { Database } from "@/types/database";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

interface ConversationParticipant {
  user_id: string;
  last_read_at: string | null;
  is_muted: boolean;
  user: {
    id: string;
    email: string;
    role: string;
    profiles: {
      name: string | null;
      avatar_url: string | null;
      presence_status: string | null;
    } | null;
  } | null;
}

interface ConversationWithParticipants extends Conversation {
  conversation_participants?: ConversationParticipant[];
  participants?: Array<{
    userId: string;
    lastReadAt: string | null;
    isMuted: boolean;
    id: string;
    email: string;
    role: string;
    profiles: {
      name: string | null;
      avatar_url: string | null;
      presence_status: string | null;
    } | null;
  }>;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<ConversationWithParticipants[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const supabase = createClient();

  const refreshConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/conversations");
      const { data } = await response.json();
      setConversations(data || []);
    } catch {
      // Fallback to direct query if API fails
      const { data } = await supabase
        .from("conversations")
        .select(
          `
          *,
          conversation_participants!conversation_participants_conversation_id_fkey(
            user_id,
            last_read_at,
            is_muted,
            user:users!conversation_participants_user_id_fkey(
              id,
              email,
              role,
              profiles:profiles(name, avatar_url, presence_status)
            )
          )
        `,
        )
        .order("last_message_at", { ascending: false });
      setConversations(data || []);
    }
  }, [supabase]);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      await refreshConversations();
      setLoading(false);

      const channel = supabase
        .channel("conversations_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversations",
          },
          () => {
            refreshConversations();
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    init();
  }, [supabase, refreshConversations]);

  useEffect(() => {
    if (!activeId) return;

    async function fetchMessages() {
      const { data } = await (supabase as any)
        .from("messages")
        .select("*")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });

      setMessages(data || []);
    }

    fetchMessages();

    const channel = supabase
      .channel(`room:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload: any) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, supabase]);

  async function handleSendMessage(content: string) {
    if (!activeId || !userId) return;
    setSendError(null);
    const { error } = await (supabase as any).from("messages").insert({
      conversation_id: activeId,
      sender_id: userId,
      content,
      message_type: "text",
    });
    if (error) setSendError(error.message);
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const activeConversation = conversations.find((c) => c.id === activeId);

  const handleConversationCreated = (conversationId: string) => {
    refreshConversations();
    setActiveId(conversationId);
  };

  return (
    <>
      <NewConversationDialog
        open={newConversationOpen}
        onOpenChange={setNewConversationOpen}
        onConversationCreated={handleConversationCreated}
      />

      <div className="h-[calc(100vh-10rem)] overflow-hidden bg-white flex">
        <div className="w-80 shrink-0 h-full border-r bg-slate-50/50">
          <ConversationList
            conversations={conversations}
            activeId={activeId || undefined}
            onSelect={setActiveId}
            userId={userId || ""}
            onNewConversation={() => setNewConversationOpen(true)}
          />
        </div>

        <div className="flex-1 h-full bg-slate-50">
          {activeId ? (
            <MessageThread
              conversation={activeConversation}
              messages={messages}
              userId={userId || ""}
              onSendMessage={handleSendMessage}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-center p-8 animate-in fade-in zoom-in duration-500">
              <div className="h-20 w-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center shadow-inner">
                <MessageSquare size={40} />
              </div>
              <div className="max-w-sm space-y-3">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Select a Conversation</h2>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  Connect with our team or your account manager for instant support and updates on your projects.
                </p>
                <Button onClick={() => setNewConversationOpen(true)} className="gap-2">
                  <PenSquare className="h-4 w-4" />
                  Start New Conversation
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
