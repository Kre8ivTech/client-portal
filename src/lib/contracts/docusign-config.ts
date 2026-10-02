/**
 * DocuSign configuration and the contract-submit decision.
 * Server-side only. Callers must not send credential values to the client.
 */

export const DOCUSIGN_REQUIRED_ENV = [
  "DOCUSIGN_INTEGRATION_KEY",
  "DOCUSIGN_USER_ID",
  "DOCUSIGN_ACCOUNT_ID",
  "DOCUSIGN_PRIVATE_KEY",
  "DOCUSIGN_OAUTH_BASE_URL",
  "DOCUSIGN_API_BASE_URL",
] as const;

export const DOCUSIGN_NOT_CONFIGURED_MESSAGE = "DocuSign is not configured";

export const DOCUSIGN_SIGNATURE_ANCHOR = "/sn1/";

export type DocuSignEnv = Record<string, string | undefined>;

export type ContractSubmitDecision =
  | { outcome: "send" }
  | { outcome: "not_configured"; message: typeof DOCUSIGN_NOT_CONFIGURED_MESSAGE };

export function missingDocuSignEnv(env: DocuSignEnv): string[] {
  return DOCUSIGN_REQUIRED_ENV.filter((name) => {
    const value = env[name];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

export function isDocuSignConfigured(env: DocuSignEnv): boolean {
  return missingDocuSignEnv(env).length === 0;
}

/**
 * Sending a contract is allowed only when every DocuSign credential is present.
 * A missing credential must block the send instead of marking the contract sent.
 */
export function decideContractSubmit(env: DocuSignEnv): ContractSubmitDecision {
  if (!isDocuSignConfigured(env)) {
    return { outcome: "not_configured", message: DOCUSIGN_NOT_CONFIGURED_MESSAGE };
  }
  return { outcome: "send" };
}

export function ensureSignatureAnchor(html: string): string {
  if (html.includes(DOCUSIGN_SIGNATURE_ANCHOR)) return html;
  return `${html}<p>${DOCUSIGN_SIGNATURE_ANCHOR}</p>`;
}

export function contractDocumentFromHtml(title: string, html: string) {
  return {
    documentBase64: Buffer.from(ensureSignatureAnchor(html), "utf8").toString("base64"),
    name: title.slice(0, 100) || "Contract",
    fileExtension: "html" as const,
    documentId: "1",
  };
}
