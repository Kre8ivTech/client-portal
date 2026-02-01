/**
 * DocuSign Types
 * TypeScript interfaces for DocuSign eSign API operations
 */

export interface DocuSignSigner {
  email: string;
  name: string;
  recipientId: string;
  routingOrder?: string;
  clientUserId?: string; // For embedded signing
}

export interface DocuSignDocument {
  documentBase64: string;
  name: string;
  fileExtension: string;
  documentId: string;
}

export interface DocuSignTab {
  anchorString?: string;
  anchorXOffset?: string;
  anchorYOffset?: string;
  anchorUnits?: string;
  xPosition?: string;
  yPosition?: string;
  documentId?: string;
  pageNumber?: string;
  recipientId?: string;
}

export type EnvelopeStatus = 
  | 'created'
  | 'sent'
  | 'delivered'
  | 'completed'
  | 'declined'
  | 'voided'
  | 'deleted';

export interface EnvelopeStatusResponse {
  envelopeId: string;
  status: EnvelopeStatus;
  statusChangedDateTime: string;
  documentsUri: string;
  recipientsUri: string;
  emailSubject: string;
  emailBlurb?: string;
  createdDateTime: string;
  sentDateTime?: string;
  completedDateTime?: string;
  voidedDateTime?: string;
  voidedReason?: string;
}

export interface CreateEnvelopeRequest {
  document: DocuSignDocument;
  signers: DocuSignSigner[];
  contractId: string;
  emailSubject: string;
  emailBlurb?: string;
  status?: 'sent' | 'created'; // sent = send immediately, created = draft
}

export interface CreateEnvelopeResponse {
  envelopeId: string;
  status: string;
  statusDateTime: string;
  uri: string;
}

export interface EnvelopeDocument {
  documentId: string;
  documentIdGuid: string;
  name: string;
  type: string;
  uri: string;
  order: string;
  pages?: string;
  availableDocumentTypes?: Array<{
    type: string;
    isDefault: string;
  }>;
}

export interface ListDocumentsResponse {
  envelopeId: string;
  envelopeDocuments: EnvelopeDocument[];
}

export interface VoidEnvelopeRequest {
  envelopeId: string;
  voidedReason: string;
}

export interface DocuSignError {
  errorCode: string;
  message: string;
}

export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}
