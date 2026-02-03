import { supabaseAdmin } from "@/lib/supabase/admin";

export type WebhookEvent =
  | "ticket.created"
  | "ticket.updated"
  | "ticket.closed"
  | "invoice.created"
  | "invoice.paid"
  | "invoice.overdue"
  | "contract.created"
  | "contract.signed"
  | "contract.completed"
  | "message.received"
  | "form.submitted";

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  organization_id: string;
  data: any;
}

/**
 * Trigger webhooks for a specific event
 */
export async function triggerWebhooks(
  event: WebhookEvent,
  organizationId: string,
  data: any
): Promise<void> {
  try {
    // Fetch all active webhooks for this event and organization
    const { data: webhooks, error } = await supabaseAdmin
      .from("zapier_webhooks")
      .select("id, url, filters")
      .eq("event_type", event)
      .eq("organization_id", organizationId)
      .eq("is_active", true);

    if (error || !webhooks || webhooks.length === 0) {
      return;
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      organization_id: organizationId,
      data,
    };

    // Send webhooks in parallel (fire and forget with error handling)
    const promises = webhooks.map(async (webhook) => {
      // Check if webhook passes filters (if any)
      if (webhook.filters && Object.keys(webhook.filters).length > 0) {
        const passesFilter = checkFilters(data, webhook.filters);
        if (!passesFilter) {
          return;
        }
      }

      await sendWebhook(webhook.id, webhook.url, payload);
    });

    // Don't await - fire and forget
    Promise.allSettled(promises);
  } catch (error) {
    console.error("Error triggering webhooks:", error);
  }
}

/**
 * Check if data passes webhook filters
 */
function checkFilters(data: any, filters: any): boolean {
  for (const [key, value] of Object.entries(filters)) {
    if (data[key] !== value) {
      return false;
    }
  }
  return true;
}

/**
 * Send a webhook to a URL
 */
async function sendWebhook(
  webhookId: string,
  url: string,
  payload: WebhookPayload
): Promise<void> {
  const startTime = Date.now();
  let success = false;
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let error: string | null = null;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "KT-Portal-Webhooks/1.0",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    statusCode = response.status;
    responseBody = await response.text();
    success = response.ok;

    // Update webhook status
    const updateData: any = {
      last_triggered_at: new Date().toISOString(),
    };

    if (success) {
      updateData.last_success_at = new Date().toISOString();
      updateData.failure_count = 0;
      updateData.last_error = null;
    } else {
      updateData.last_failure_at = new Date().toISOString();
      updateData.last_error = `HTTP ${statusCode}: ${responseBody?.substring(0, 500)}`;
      
      // Increment failure count
      const { data: webhook } = await supabaseAdmin
        .from("zapier_webhooks")
        .select("failure_count")
        .eq("id", webhookId)
        .single();
      
      updateData.failure_count = (webhook?.failure_count || 0) + 1;
      
      // Disable webhook after 10 consecutive failures
      if (updateData.failure_count >= 10) {
        updateData.is_active = false;
      }
    }

    await supabaseAdmin
      .from("zapier_webhooks")
      .update(updateData)
      .eq("id", webhookId);
  } catch (err: any) {
    error = err.message;
    
    // Update webhook with error
    const { data: webhook } = await supabaseAdmin
      .from("zapier_webhooks")
      .select("failure_count")
      .eq("id", webhookId)
      .single();
    
    const failureCount = (webhook?.failure_count || 0) + 1;
    
    await supabaseAdmin
      .from("zapier_webhooks")
      .update({
        last_triggered_at: new Date().toISOString(),
        last_failure_at: new Date().toISOString(),
        last_error: error,
        failure_count: failureCount,
        is_active: failureCount < 10, // Disable after 10 failures
      })
      .eq("id", webhookId);
  }

  const duration = Date.now() - startTime;

  // Log delivery attempt
  await supabaseAdmin.from("webhook_deliveries").insert({
    webhook_id: webhookId,
    event_type: payload.event,
    payload: payload.data,
    status_code: statusCode,
    response_body: responseBody?.substring(0, 1000), // Limit size
    error: error,
    duration_ms: duration,
    success,
  });
}
