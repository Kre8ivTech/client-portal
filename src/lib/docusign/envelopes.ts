/**
 * DocuSign Envelopes Module
 * Handles envelope creation, status checking, and document management
 */

// Bypass static analysis for problematic AMD module
const docusign = typeof window === 'undefined' ? eval('require("docusign-esign")') : null;
import { getApiClient, getAccountId } from './auth';
import type {
  CreateEnvelopeRequest,
  CreateEnvelopeResponse,
  EnvelopeStatusResponse,
  ListDocumentsResponse,
  VoidEnvelopeRequest,
  DocuSignDocument,
  DocuSignSigner,
} from '@/types/docusign';

/**
 * Creates and sends an envelope with documents for signing
 * @param document - Document to be signed (base64 encoded)
 * @param signers - Array of signers with email and name
 * @param contractId - Contract ID for tracking purposes
 * @returns Envelope ID and status
 */
export async function createEnvelope(
  document: DocuSignDocument,
  signers: DocuSignSigner[],
  contractId: string,
  emailSubject?: string,
  emailBlurb?: string
): Promise<CreateEnvelopeResponse> {
  try {
    const apiClient = await getApiClient();
    const accountId = getAccountId();

    // Create envelope definition
    const envelopeDefinition = new docusign.EnvelopeDefinition();
    envelopeDefinition.emailSubject = emailSubject || `Please sign: ${document.name}`;
    
    if (emailBlurb) {
      envelopeDefinition.emailBlurb = emailBlurb;
    }

    // Add custom field for contract tracking
    envelopeDefinition.customFields = {
      textCustomFields: [
        {
          name: 'contractId',
          value: contractId,
          show: 'false',
          required: 'false',
        },
      ],
    };

    // Add document
    const doc = new docusign.Document();
    doc.documentBase64 = document.documentBase64;
    doc.name = document.name;
    doc.fileExtension = document.fileExtension;
    doc.documentId = document.documentId;
    envelopeDefinition.documents = [doc];

    // Add signers
    const recipientSigners = signers.map((signer: any) => {
      const recipient = new docusign.Signer();
      recipient.email = signer.email;
      recipient.name = signer.name;
      recipient.recipientId = signer.recipientId;
      recipient.routingOrder = signer.routingOrder || '1';
      
      if (signer.clientUserId) {
        recipient.clientUserId = signer.clientUserId;
      }

      // Add signature tab
      const signHere = docusign.SignHere.constructFromObject({
        anchorString: '/sn1/',
        anchorUnits: 'pixels',
        anchorXOffset: '10',
        anchorYOffset: '20',
      });

      // Add tabs
      const tabs = docusign.Tabs.constructFromObject({
        signHereTabs: [signHere],
      });
      recipient.tabs = tabs;

      return recipient;
    });

    envelopeDefinition.recipients = docusign.Recipients.constructFromObject({
      signers: recipientSigners,
    });

    // Set status to 'sent' to send immediately
    envelopeDefinition.status = 'sent';

    // Create envelope
    const envelopesApi = new docusign.EnvelopesApi(apiClient);
    const results = await envelopesApi.createEnvelope(accountId, {
      envelopeDefinition,
    });

    if (!results.envelopeId) {
      throw new Error('Failed to create envelope: No envelope ID returned');
    }

    return {
      envelopeId: results.envelopeId,
      status: results.status || 'sent',
      statusDateTime: results.statusDateTime || new Date().toISOString(),
      uri: results.uri || '',
    };
  } catch (error: any) {
    throw new Error(
      `Failed to create DocuSign envelope: ${error.message || JSON.stringify(error.response?.body || error)}`
    );
  }
}

/**
 * Gets the current status of an envelope
 * @param envelopeId - The envelope ID
 * @returns Envelope status information
 */
export async function getEnvelopeStatus(
  envelopeId: string
): Promise<EnvelopeStatusResponse> {
  try {
    const apiClient = await getApiClient();
    const accountId = getAccountId();

    const envelopesApi = new docusign.EnvelopesApi(apiClient);
    const envelope = await envelopesApi.getEnvelope(accountId, envelopeId);

    return {
      envelopeId: envelope.envelopeId || envelopeId,
      status: envelope.status as EnvelopeStatusResponse['status'],
      statusChangedDateTime: envelope.statusChangedDateTime || '',
      documentsUri: envelope.documentsUri || '',
      recipientsUri: envelope.recipientsUri || '',
      emailSubject: envelope.emailSubject || '',
      emailBlurb: envelope.emailBlurb,
      createdDateTime: envelope.createdDateTime || '',
      sentDateTime: envelope.sentDateTime,
      completedDateTime: envelope.completedDateTime,
      voidedDateTime: envelope.voidedDateTime,
      voidedReason: envelope.voidedReason,
    };
  } catch (error: any) {
    throw new Error(
      `Failed to get envelope status: ${error.message || JSON.stringify(error.response?.body || error)}`
    );
  }
}

/**
 * Downloads a signed document from an envelope
 * @param envelopeId - The envelope ID
 * @param documentId - The document ID (default: 'combined' for all documents)
 * @returns Document as Buffer
 */
export async function downloadDocument(
  envelopeId: string,
  documentId: string = 'combined'
): Promise<Buffer> {
  try {
    const apiClient = await getApiClient();
    const accountId = getAccountId();

    const envelopesApi = new docusign.EnvelopesApi(apiClient);
    const document = await envelopesApi.getDocument(
      accountId,
      envelopeId,
      documentId
    );

    // The document is returned as a Buffer
    return Buffer.from(document);
  } catch (error: any) {
    throw new Error(
      `Failed to download document: ${error.message || JSON.stringify(error.response?.body || error)}`
    );
  }
}

/**
 * Voids (cancels) an envelope
 * @param envelopeId - The envelope ID
 * @param reason - Reason for voiding
 * @returns Updated envelope status
 */
export async function voidEnvelope(
  envelopeId: string,
  reason: string
): Promise<EnvelopeStatusResponse> {
  try {
    const apiClient = await getApiClient();
    const accountId = getAccountId();

    const envelopeDefinition = new docusign.Envelope();
    envelopeDefinition.status = 'voided';
    envelopeDefinition.voidedReason = reason;

    const envelopesApi = new docusign.EnvelopesApi(apiClient);
    const result = await envelopesApi.update(accountId, envelopeId, {
      envelope: envelopeDefinition,
    });

    return {
      envelopeId: result.envelopeId || envelopeId,
      status: result.status as EnvelopeStatusResponse['status'],
      statusChangedDateTime: result.statusChangedDateTime || new Date().toISOString(),
      documentsUri: result.documentsUri || '',
      recipientsUri: result.recipientsUri || '',
      emailSubject: result.emailSubject || '',
      emailBlurb: result.emailBlurb,
      createdDateTime: result.createdDateTime || '',
      sentDateTime: result.sentDateTime,
      completedDateTime: result.completedDateTime,
      voidedDateTime: result.voidedDateTime,
      voidedReason: result.voidedReason || reason,
    };
  } catch (error: any) {
    throw new Error(
      `Failed to void envelope: ${error.message || JSON.stringify(error.response?.body || error)}`
    );
  }
}

/**
 * Lists all documents in an envelope
 * @param envelopeId - The envelope ID
 * @returns List of documents with metadata
 */
export async function listEnvelopeDocuments(
  envelopeId: string
): Promise<ListDocumentsResponse> {
  try {
    const apiClient = await getApiClient();
    const accountId = getAccountId();

    const envelopesApi = new docusign.EnvelopesApi(apiClient);
    const result = await envelopesApi.listDocuments(accountId, envelopeId);

    return {
      envelopeId: result.envelopeId || envelopeId,
      envelopeDocuments: (result.envelopeDocuments || []).map((doc: any) => ({
        documentId: doc.documentId || '',
        documentIdGuid: doc.documentIdGuid || '',
        name: doc.name || '',
        type: doc.type || '',
        uri: doc.uri || '',
        order: doc.order || '',
        pages: doc.pages,
        availableDocumentTypes: doc.availableDocumentTypes,
      })),
    };
  } catch (error: any) {
    throw new Error(
      `Failed to list envelope documents: ${error.message || JSON.stringify(error.response?.body || error)}`
    );
  }
}

/**
 * Gets recipient status for an envelope
 * @param envelopeId - The envelope ID
 * @returns Recipient information and signing status
 */
export async function getRecipientStatus(envelopeId: string): Promise<any> {
  try {
    const apiClient = await getApiClient();
    const accountId = getAccountId();

    const envelopesApi = new docusign.EnvelopesApi(apiClient);
    const result = await envelopesApi.listRecipients(accountId, envelopeId);

    return result;
  } catch (error: any) {
    throw new Error(
      `Failed to get recipient status: ${error.message || JSON.stringify(error.response?.body || error)}`
    );
  }
}
