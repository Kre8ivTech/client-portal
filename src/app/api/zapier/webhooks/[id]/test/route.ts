import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// POST: Test a webhook by sending a sample payload
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get webhook details
    const { data: webhook, error } = await supabase
      .from("zapier_webhooks")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (error || !webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    // Create sample payload based on event type
    const sampleData = getSampleDataForEvent(webhook.event_type);

    const payload = {
      event: webhook.event_type,
      timestamp: new Date().toISOString(),
      organization_id: webhook.organization_id,
      data: sampleData,
      test: true,
    };

    // Send test webhook
    const startTime = Date.now();
    let success = false;
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let error: string | null = null;

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "KT-Portal-Webhooks/1.0",
          "X-Test-Webhook": "true",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      statusCode = response.status;
      responseBody = await response.text();
      success = response.ok;
    } catch (err: any) {
      error = err.message;
    }

    const duration = Date.now() - startTime;

    // Log delivery attempt
    await supabaseAdmin.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      event_type: webhook.event_type,
      payload: sampleData,
      status_code: statusCode,
      response_body: responseBody?.substring(0, 1000),
      error: error,
      duration_ms: duration,
      success,
    });

    return NextResponse.json({
      success,
      status_code: statusCode,
      response_body: responseBody,
      error: error,
      duration_ms: duration,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function getSampleDataForEvent(eventType: string): any {
  const samples: Record<string, any> = {
    "ticket.created": {
      id: "00000000-0000-0000-0000-000000000000",
      ticket_number: "T-1234",
      subject: "Sample ticket",
      description: "This is a test webhook",
      status: "open",
      priority: "medium",
      created_at: new Date().toISOString(),
    },
    "ticket.updated": {
      id: "00000000-0000-0000-0000-000000000000",
      ticket_number: "T-1234",
      subject: "Sample ticket",
      status: "in_progress",
      updated_at: new Date().toISOString(),
    },
    "ticket.closed": {
      id: "00000000-0000-0000-0000-000000000000",
      ticket_number: "T-1234",
      subject: "Sample ticket",
      status: "closed",
      closed_at: new Date().toISOString(),
    },
    "invoice.created": {
      id: "00000000-0000-0000-0000-000000000000",
      invoice_number: "INV-001",
      amount: 1000,
      status: "draft",
      created_at: new Date().toISOString(),
    },
    "invoice.paid": {
      id: "00000000-0000-0000-0000-000000000000",
      invoice_number: "INV-001",
      amount: 1000,
      status: "paid",
      paid_at: new Date().toISOString(),
    },
    "contract.created": {
      id: "00000000-0000-0000-0000-000000000000",
      title: "Sample contract",
      status: "draft",
      created_at: new Date().toISOString(),
    },
    "contract.signed": {
      id: "00000000-0000-0000-0000-000000000000",
      title: "Sample contract",
      status: "signed",
      signed_at: new Date().toISOString(),
    },
    "message.received": {
      id: "00000000-0000-0000-0000-000000000000",
      content: "This is a test message",
      created_at: new Date().toISOString(),
    },
    "form.submitted": {
      id: "00000000-0000-0000-0000-000000000000",
      form_name: "Contact Form",
      submitted_at: new Date().toISOString(),
    },
  };

  return samples[eventType] || { test: true };
}
