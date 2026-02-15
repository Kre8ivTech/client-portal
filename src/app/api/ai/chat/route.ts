import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Helper to get system settings (privileged)
async function getSystemSettings() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("*")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .single();

  return data;
}

// Initialize clients with dynamic keys
function getOpenRouterClient(apiKey: string) {
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });
}

function getAnthropicClient(apiKey: string) {
  return new Anthropic({
    apiKey,
  });
}

function getOpenAIClient(apiKey: string) {
  return new OpenAI({
    apiKey,
  });
}

async function getOpenRouterResponse(messages: any[], systemPrompt: string, apiKey: string) {
  console.log("Attempting OpenRouter...");
  const client = getOpenRouterClient(apiKey);
  const response = await client.chat.completions.create({
    model: "anthropic/claude-3.5-sonnet",
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  }, {
    headers: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://client-portal.com",
      "X-Title": "Client Portal AI",
    },
  });
  return response.choices[0]?.message?.content;
}

async function getAnthropicResponse(messages: any[], systemPrompt: string, apiKey: string) {
  console.log("Attempting Anthropic fallback...");
  const client = getAnthropicClient(apiKey);
  // Convert messages to Anthropic format (no system role in messages array)
  const anthropicMessages = messages.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  })) as Anthropic.MessageParam[];

  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    system: systemPrompt,
    messages: anthropicMessages,
  });

  return response.content[0].type === "text" ? response.content[0].text : null;
}

async function getOpenAIResponse(messages: any[], systemPrompt: string, apiKey: string) {
  console.log("Attempting OpenAI fallback...");
  const client = getOpenAIClient(apiKey);
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  });
  return response.choices[0]?.message?.content;
}

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

    const body = await request.json();
    const { conversation_id, message, organization_id } = body;

    if (!conversation_id || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch context data (handle missing tables gracefully)
    let conversationMessages: any[] = [];
    let orgDocuments: any[] = [];
    let orgRules: any[] = [];
    let aiConfigs: any = null;
    let appSettings: any = null;

    // Fetch conversation messages
    const { data: msgData, error: msgError } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(20);

    if (!msgError) conversationMessages = msgData || [];

    // Fetch documents (may not exist)
    const { data: docData } = await supabase
      .from("ai_documents")
      .select("title, content, document_type")
      .or(organization_id ? `organization_id.eq.${organization_id},organization_id.is.null` : "organization_id.is.null")
      .limit(10);

    if (docData) orgDocuments = docData;

    // Fetch rules (may not exist)
    const { data: rulesData } = await supabase
      .from("ai_rules")
      .select("rule_name, rule_content, priority")
      .or(organization_id ? `organization_id.eq.${organization_id},organization_id.is.null` : "organization_id.is.null")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (rulesData) orgRules = rulesData;

    // Fetch AI config (may not exist)
    const { data: configData } = await supabase
      .from("ai_configs")
      .select("system_prompt, model_params, greeting_message")
      .or(organization_id ? `organization_id.eq.${organization_id},organization_id.is.null` : "organization_id.is.null")
      .eq("is_active", true)
      .order("organization_id", { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (configData) aiConfigs = configData;

    // Get system settings
    appSettings = await getSystemSettings();

    // Resolve Keys (DB > Env)
    const openRouterKey = appSettings?.openrouter_api_key || process.env.OPENROUTER_API_KEY;
    const anthropicKey = appSettings?.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
    const openaiKey = appSettings?.openai_api_key || process.env.OPENAI_API_KEY;
    const primaryProvider = appSettings?.ai_provider_primary || "openrouter";

    let systemPrompt = "You are a helpful AI assistant for a client portal.";

    if (aiConfigs) {
      systemPrompt = aiConfigs.system_prompt || systemPrompt;
    }

    if (orgRules && orgRules.length > 0) {
      systemPrompt += "\n\nIMPORTANT RULES TO FOLLOW:\n";
      orgRules.forEach((rule: any) => {
        systemPrompt += `- ${rule.rule_name}: ${rule.rule_content}\n`;
      });
    }

    if (orgDocuments && orgDocuments.length > 0) {
      systemPrompt += "\n\nRELEVANT KNOWLEDGE BASE:\n";
      orgDocuments.forEach((doc: any) => {
        systemPrompt += `\n[${doc.document_type.toUpperCase()}] ${doc.title}:\n${doc.content}\n`;
      });
    }

    const conversationHistory = (conversationMessages || []).map((msg: any) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }));

    // Current message
    const messages = [...conversationHistory, { role: "user", content: message }];

    let assistantMessage: string | null | undefined = null;
    let errorDetails: any = {};

    // Execution Order based on Primary Provider
    const providers = [];

    // Add primary first
    if (primaryProvider === "openrouter") providers.push("openrouter");
    else if (primaryProvider === "anthropic") providers.push("anthropic");
    else if (primaryProvider === "openai") providers.push("openai");

    // Add backups (avoid duplicates)
    if (!providers.includes("openrouter")) providers.push("openrouter");
    if (!providers.includes("anthropic")) providers.push("anthropic");
    if (!providers.includes("openai")) providers.push("openai");

    // Execute
    for (const provider of providers) {
      if (assistantMessage) break; // Stop if success

      try {
        if (provider === "openrouter" && openRouterKey) {
          assistantMessage = await getOpenRouterResponse(messages, systemPrompt, openRouterKey);
        } else if (provider === "anthropic" && anthropicKey) {
          assistantMessage = await getAnthropicResponse(messages, systemPrompt, anthropicKey);
        } else if (provider === "openai" && openaiKey) {
          assistantMessage = await getOpenAIResponse(messages, systemPrompt, openaiKey);
        }
      } catch (e: any) {
        console.error(`${provider} failed:`, e.message);
        errorDetails[provider] = e.message;
      }
    }

    if (!assistantMessage) {
      console.error("All AI providers failed", errorDetails);
      return NextResponse.json({ error: "AI service unavailable. All providers failed." }, { status: 503 });
    }

    return NextResponse.json({
      message: assistantMessage,
      conversation_id,
    });
  } catch (error: any) {
    console.error("AI chat error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
