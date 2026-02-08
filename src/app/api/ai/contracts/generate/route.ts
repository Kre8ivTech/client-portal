import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { streamText, convertToModelMessages, UIMessage } from "ai";

const systemPrompt = `You are an expert legal document assistant helping to create professional contract templates.

Your role is to:
1. Generate clear, professional contract language
2. Suggest appropriate clauses based on the contract type
3. Help structure contracts with proper sections
4. Use {{variable_name}} syntax for dynamic fields that will be filled in later
5. Provide legally sound but accessible language

When generating contract content:
- Always use {{variable_name}} syntax for dynamic fields (e.g., {{client_name}}, {{effective_date}}, {{payment_amount}})
- Use lowercase_with_underscores for variable names
- Include standard clauses appropriate for the contract type
- Structure content with clear sections and numbering
- Be concise but comprehensive

Contract types you can help with:
- Service Agreement: Standard service contracts between provider and client
- NDA: Non-disclosure agreements for protecting confidential information
- MSA: Master Service Agreements for ongoing business relationships
- SOW: Statement of Work for specific project deliverables
- Amendment: Modifications to existing contracts

Respond with properly formatted contract text. When asked to generate a full contract, provide complete sections. When asked for specific clauses, provide just those sections.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { messages, contractType, templateName } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    // Build context-aware system prompt
    let contextualPrompt = systemPrompt;
    if (contractType) {
      contextualPrompt += `\n\nThe user is creating a ${contractType} template${templateName ? ` called "${templateName}"` : ''}.`;
    }

    // Convert UI messages to model messages
    const modelMessages = await convertToModelMessages(messages as UIMessage[]);

    const result = streamText({
      model: "anthropic/claude-sonnet-4-20250514",
      system: contextualPrompt,
      messages: modelMessages,
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("Contract AI generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate contract content" },
      { status: 500 }
    );
  }
}
