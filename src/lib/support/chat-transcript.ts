export type ChatTranscriptMessage = {
  sender_type: string;
  content: string;
  is_internal?: boolean | null;
};

export function chatTicketDraft(input: {
  visitorName: string;
  visitorEmail: string | null;
  messages: ChatTranscriptMessage[];
}): { subject: string; description: string } {
  const name = input.visitorName.trim() || "Website visitor";
  const lines = input.messages
    .filter((message) => !message.is_internal && message.content.trim())
    .map((message) => `${message.sender_type}: ${message.content.trim()}`);

  const description = [
    `Visitor: ${name}`,
    input.visitorEmail ? `Email: ${input.visitorEmail}` : "",
    "",
    lines.length ? lines.join("\n\n") : "No messages were saved on this chat.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return {
    subject: `Live chat with ${name}`.slice(0, 200),
    description,
  };
}
