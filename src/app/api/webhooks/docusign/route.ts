import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { downloadDocument } from '@/lib/docusign/envelopes';
import { uploadContract } from '@/lib/storage/s3';
import { triggerWebhooks } from '@/lib/zapier/webhooks';

export const runtime = 'nodejs';

/**
 * DocuSign Connect Webhook Handler
 * Processes DocuSign envelope events: completed, declined, voided, recipient-signed
 */
export async function POST(request: NextRequest) {
  console.log('[DocuSign Webhook] Received webhook request');

  try {
    const body = await request.text();
    
    // Verify webhook authenticity if secret is configured
    if (process.env.DOCUSIGN_WEBHOOK_SECRET) {
      const signature = request.headers.get('x-docusign-signature-1') || 
                       request.headers.get('x-authorization-1');
      
      if (!signature) {
        console.warn('[DocuSign Webhook] Missing signature header');
        // Log but don't fail - return 200 to prevent retries
        return NextResponse.json({ received: true, warning: 'Missing signature' });
      }

      if (!verifyWebhookSignature(body, signature, process.env.DOCUSIGN_WEBHOOK_SECRET)) {
        console.error('[DocuSign Webhook] Invalid signature');
        // Log but return 200 to prevent retries
        return NextResponse.json({ received: true, warning: 'Invalid signature' });
      }
    } else {
      console.warn('[DocuSign Webhook] DOCUSIGN_WEBHOOK_SECRET not configured - skipping verification');
    }

    // Parse the DocuSign event payload
    // DocuSign Connect can send XML or JSON. We'll handle both.
    const event = parseDocuSignEvent(body);
    
    if (!event) {
      console.error('[DocuSign Webhook] Failed to parse event payload');
      return NextResponse.json({ received: true, warning: 'Failed to parse payload' });
    }

    console.log(`[DocuSign Webhook] Processing event: ${event.eventType} for envelope ${event.envelopeId}`);

    // Process the event
    await processDocuSignEvent(event);

    console.log(`[DocuSign Webhook] Successfully processed event: ${event.eventType}`);
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[DocuSign Webhook] Error processing webhook:', error);
    // Always return 200 to prevent DocuSign from retrying
    // Log the error for manual investigation
    return NextResponse.json({ 
      received: true, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * Verify webhook signature using HMAC
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('base64');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[DocuSign Webhook] Signature verification error:', error);
    return false;
  }
}

/**
 * Parse DocuSign event from XML or JSON payload
 */
function parseDocuSignEvent(payload: string): DocuSignWebhookEvent | null {
  try {
    // Try parsing as JSON first
    const data = JSON.parse(payload);
    
    // DocuSign Connect JSON format
    if (data.event) {
      return {
        eventType: normalizeEventType(data.event),
        envelopeId: data.data?.envelopeId || data.envelopeId,
        envelopeSummary: data.data?.envelopeSummary || data,
        recipients: data.data?.envelopeSummary?.recipients || data.recipients,
        customFields: data.data?.envelopeSummary?.customFields || data.customFields,
      };
    }
    
    // If JSON doesn't match expected format, try XML parsing
    return parseXMLEvent(payload);
  } catch (error) {
    // Not JSON, try XML
    return parseXMLEvent(payload);
  }
}

/**
 * Parse DocuSign XML event (simplified parser)
 * For production, consider using a proper XML parser library
 */
function parseXMLEvent(xml: string): DocuSignWebhookEvent | null {
  try {
    // Extract envelope ID
    const envelopeIdMatch = xml.match(/<EnvelopeID>([^<]+)<\/EnvelopeID>/i);
    const envelopeId = envelopeIdMatch?.[1];

    // Extract envelope status
    const statusMatch = xml.match(/<Status>([^<]+)<\/Status>/i);
    const status = statusMatch?.[1];

    if (!envelopeId || !status) {
      console.error('[DocuSign Webhook] Missing envelope ID or status in XML');
      return null;
    }

    // Extract custom fields (looking for contractId)
    const customFields: Record<string, string> = {};
    const customFieldMatches = xml.matchAll(/<CustomField>.*?<Name>([^<]+)<\/Name>.*?<Value>([^<]+)<\/Value>.*?<\/CustomField>/gs);
    for (const match of customFieldMatches) {
      customFields[match[1]] = match[2];
    }

    // Extract recipient information
    const recipients: any[] = [];
    const recipientMatches = xml.matchAll(/<RecipientStatus>.*?<Email>([^<]+)<\/Email>.*?<Status>([^<]+)<\/Status>.*?<RecipientId>([^<]+)<\/RecipientId>.*?<\/RecipientStatus>/gs);
    for (const match of recipientMatches) {
      recipients.push({
        email: match[1],
        status: match[2],
        recipientId: match[3],
      });
    }

    return {
      eventType: normalizeEventType(status),
      envelopeId,
      envelopeSummary: { status },
      recipients,
      customFields: { textCustomFields: Object.entries(customFields).map(([name, value]) => ({ name, value })) },
    };
  } catch (error) {
    console.error('[DocuSign Webhook] XML parsing error:', error);
    return null;
  }
}

/**
 * Normalize event type to standard format
 */
function normalizeEventType(status: string): string {
  const normalized = status.toLowerCase().replace(/[_-]/g, '');
  
  if (normalized.includes('completed')) return 'envelope-completed';
  if (normalized.includes('declined')) return 'envelope-declined';
  if (normalized.includes('voided')) return 'envelope-voided';
  if (normalized.includes('signed')) return 'recipient-signed';
  
  return status;
}

/**
 * Process DocuSign event
 */
async function processDocuSignEvent(event: DocuSignWebhookEvent): Promise<void> {
  // Extract contract ID from custom fields
  const contractId = extractContractId(event.customFields);
  
  if (!contractId) {
    console.error('[DocuSign Webhook] No contractId found in custom fields');
    return;
  }

  console.log(`[DocuSign Webhook] Processing event for contract ${contractId}`);

  // Fetch contract to get organization_id
  const { data: contract, error: contractError } = await (supabaseAdmin as any)
    .from('contracts')
    .select('id, organization_id, docusign_envelope_id')
    .eq('id', contractId)
    .single();

  if (contractError || !contract) {
    console.error(`[DocuSign Webhook] Contract ${contractId} not found:`, contractError);
    return;
  }

  switch (event.eventType) {
    case 'envelope-completed':
      await handleEnvelopeCompleted(contract, event);
      break;

    case 'envelope-declined':
      await handleEnvelopeDeclined(contract, event);
      break;

    case 'envelope-voided':
      await handleEnvelopeVoided(contract, event);
      break;

    case 'recipient-signed':
      await handleRecipientSigned(contract, event);
      break;

    default:
      console.log(`[DocuSign Webhook] Unhandled event type: ${event.eventType}`);
  }
}

/**
 * Handle envelope-completed event
 */
async function handleEnvelopeCompleted(
  contract: { id: string; organization_id: string; docusign_envelope_id: string | null },
  event: DocuSignWebhookEvent
): Promise<void> {
  console.log(`[DocuSign Webhook] Envelope completed for contract ${contract.id}`);

  try {
    // Download signed document from DocuSign
    const documentBuffer = await downloadDocument(event.envelopeId, 'combined');
    
    // Upload to S3
    const filename = `signed_${event.envelopeId}_${Date.now()}.pdf`;
    const documentUrl = await uploadContract(
      contract.id,
      contract.organization_id,
      documentBuffer,
      filename
    );

    console.log(`[DocuSign Webhook] Uploaded signed document to S3: ${documentUrl}`);

    // Update contract
    const { error: updateError } = await (supabaseAdmin as any)
      .from('contracts')
      .update({
        status: 'signed',
        document_url: documentUrl,
        signed_at: new Date().toISOString(),
        docusign_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contract.id);

    if (updateError) {
      console.error('[DocuSign Webhook] Failed to update contract:', updateError);
      throw updateError;
    }

    // Update all signers to signed
    const { error: signersError } = await (supabaseAdmin as any)
      .from('contract_signers')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
      })
      .eq('contract_id', contract.id);

    if (signersError) {
      console.error('[DocuSign Webhook] Failed to update signers:', signersError);
    }

    // Create audit log entry
    await createAuditLog(contract.id, 'envelope_completed', {
      envelopeId: event.envelopeId,
      documentUrl,
      message: 'All signers have completed the contract',
    });

    // Trigger Zapier webhook for contract signed
    triggerWebhooks('contract.signed', contract.organization_id, {
      id: contract.id,
      status: 'signed',
      signed_at: new Date().toISOString(),
      document_url: documentUrl,
    });

    console.log(`[DocuSign Webhook] Successfully processed envelope completion for contract ${contract.id}`);
  } catch (error) {
    console.error('[DocuSign Webhook] Error handling envelope completion:', error);
    throw error;
  }
}

/**
 * Handle envelope-declined event
 */
async function handleEnvelopeDeclined(
  contract: { id: string; organization_id: string; docusign_envelope_id: string | null },
  event: DocuSignWebhookEvent
): Promise<void> {
  console.log(`[DocuSign Webhook] Envelope declined for contract ${contract.id}`);

  try {
    // Find the recipient who declined
    const declinedRecipient = event.recipients?.find(
      (r: any) => r.status?.toLowerCase() === 'declined'
    );

    // Update contract status
    const { error: updateError } = await (supabaseAdmin as any)
      .from('contracts')
      .update({
        status: 'cancelled',
        docusign_status: 'declined',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contract.id);

    if (updateError) {
      console.error('[DocuSign Webhook] Failed to update contract:', updateError);
      throw updateError;
    }

    // Update signer who declined
    if (declinedRecipient?.email) {
      const { error: signerError } = await (supabaseAdmin as any)
        .from('contract_signers')
        .update({
          status: 'declined',
        })
        .eq('contract_id', contract.id)
        .eq('email', declinedRecipient.email);

      if (signerError) {
        console.error('[DocuSign Webhook] Failed to update signer:', signerError);
      }
    }

    // Create audit log entry
    await createAuditLog(contract.id, 'envelope_declined', {
      envelopeId: event.envelopeId,
      declinedBy: declinedRecipient?.email,
      message: `Contract declined by ${declinedRecipient?.email || 'unknown signer'}`,
    });

    console.log(`[DocuSign Webhook] Successfully processed envelope decline for contract ${contract.id}`);
  } catch (error) {
    console.error('[DocuSign Webhook] Error handling envelope decline:', error);
    throw error;
  }
}

/**
 * Handle envelope-voided event
 */
async function handleEnvelopeVoided(
  contract: { id: string; organization_id: string; docusign_envelope_id: string | null },
  event: DocuSignWebhookEvent
): Promise<void> {
  console.log(`[DocuSign Webhook] Envelope voided for contract ${contract.id}`);

  try {
    // Update contract status
    const { error: updateError } = await (supabaseAdmin as any)
      .from('contracts')
      .update({
        status: 'cancelled',
        docusign_status: 'voided',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contract.id);

    if (updateError) {
      console.error('[DocuSign Webhook] Failed to update contract:', updateError);
      throw updateError;
    }

    // Create audit log entry
    await createAuditLog(contract.id, 'envelope_voided', {
      envelopeId: event.envelopeId,
      voidedReason: event.envelopeSummary?.voidedReason,
      message: 'Contract envelope was voided/cancelled',
    });

    console.log(`[DocuSign Webhook] Successfully processed envelope void for contract ${contract.id}`);
  } catch (error) {
    console.error('[DocuSign Webhook] Error handling envelope void:', error);
    throw error;
  }
}

/**
 * Handle recipient-signed event
 */
async function handleRecipientSigned(
  contract: { id: string; organization_id: string; docusign_envelope_id: string | null },
  event: DocuSignWebhookEvent
): Promise<void> {
  console.log(`[DocuSign Webhook] Recipient signed for contract ${contract.id}`);

  try {
    // Find the recipient who just signed
    const signedRecipient = event.recipients?.find(
      (r: any) => r.status?.toLowerCase() === 'signed' || r.status?.toLowerCase() === 'completed'
    );

    if (!signedRecipient?.email) {
      console.warn('[DocuSign Webhook] No signed recipient found in event');
      return;
    }

    // Update specific signer status
    const { error: signerError } = await (supabaseAdmin as any)
      .from('contract_signers')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
      })
      .eq('contract_id', contract.id)
      .eq('email', signedRecipient.email);

    if (signerError) {
      console.error('[DocuSign Webhook] Failed to update signer:', signerError);
      throw signerError;
    }

    // Create audit log entry
    await createAuditLog(contract.id, 'recipient_signed', {
      envelopeId: event.envelopeId,
      signerEmail: signedRecipient.email,
      recipientId: signedRecipient.recipientId,
      message: `${signedRecipient.email} signed the contract`,
    });

    console.log(`[DocuSign Webhook] Successfully processed recipient signed for contract ${contract.id}`);
  } catch (error) {
    console.error('[DocuSign Webhook] Error handling recipient signed:', error);
    throw error;
  }
}

/**
 * Create audit log entry
 */
async function createAuditLog(
  contractId: string,
  action: string,
  details: Record<string, any>
): Promise<void> {
  try {
    const { error } = await (supabaseAdmin as any)
      .from('contract_audit_log')
      .insert({
        contract_id: contractId,
        action,
        performed_by: null, // System/webhook action
        details,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[DocuSign Webhook] Failed to create audit log:', error);
      // Don't throw - audit log failure shouldn't break the webhook
    }
  } catch (error) {
    console.error('[DocuSign Webhook] Error creating audit log:', error);
  }
}

/**
 * Extract contract ID from DocuSign custom fields
 */
function extractContractId(customFields: any): string | null {
  try {
    if (!customFields) return null;

    // Handle different custom field formats
    if (Array.isArray(customFields)) {
      const field = customFields.find((f: any) => f.name === 'contractId');
      return field?.value || null;
    }

    if (customFields.textCustomFields) {
      const field = customFields.textCustomFields.find(
        (f: any) => f.name === 'contractId'
      );
      return field?.value || null;
    }

    return null;
  } catch (error) {
    console.error('[DocuSign Webhook] Error extracting contract ID:', error);
    return null;
  }
}

/**
 * DocuSign webhook event interface
 */
interface DocuSignWebhookEvent {
  eventType: string;
  envelopeId: string;
  envelopeSummary?: any;
  recipients?: any[];
  customFields?: any;
}
