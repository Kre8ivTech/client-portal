/**
 * DocuSign Authentication Module
 * Handles JWT authentication with DocuSign API
 */

import docusign from 'docusign-esign';
import type { AccessTokenResponse } from '@/types/docusign';

const SCOPES = ['signature', 'impersonation'];
const TOKEN_EXPIRATION_BUFFER = 10 * 60 * 1000; // 10 minutes in milliseconds

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Validates required environment variables
 */
function validateEnvVars(): void {
  const required = [
    'DOCUSIGN_INTEGRATION_KEY',
    'DOCUSIGN_USER_ID',
    'DOCUSIGN_ACCOUNT_ID',
    'DOCUSIGN_PRIVATE_KEY',
    'DOCUSIGN_OAUTH_BASE_URL',
    'DOCUSIGN_API_BASE_URL',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required DocuSign environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Formats the private key from environment variable
 * Handles both single-line and multi-line formats
 */
function formatPrivateKey(key: string): string {
  // Replace literal \n with actual newlines
  return key.replace(/\\n/g, '\n');
}

/**
 * Gets a valid access token, using cache if available
 * Automatically refreshes expired tokens
 */
export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  // Validate environment variables
  validateEnvVars();

  try {
    const apiClient = new docusign.ApiClient();
    apiClient.setOAuthBasePath(
      process.env.DOCUSIGN_OAUTH_BASE_URL!.replace('https://', '')
    );

    const privateKey = formatPrivateKey(process.env.DOCUSIGN_PRIVATE_KEY!);

    const results = await apiClient.requestJWTUserToken(
      process.env.DOCUSIGN_INTEGRATION_KEY!,
      process.env.DOCUSIGN_USER_ID!,
      SCOPES,
      privateKey,
      3600 // Token lifetime in seconds (1 hour)
    );

    const accessToken = results.body.access_token;
    const expiresIn = results.body.expires_in * 1000; // Convert to milliseconds

    // Cache the token with expiration buffer
    tokenCache = {
      token: accessToken,
      expiresAt: Date.now() + expiresIn - TOKEN_EXPIRATION_BUFFER,
    };

    return accessToken;
  } catch (error: any) {
    // Handle consent required error
    if (error.response?.body?.error === 'consent_required') {
      const consentUrl = `${process.env.DOCUSIGN_OAUTH_BASE_URL}/oauth/auth?response_type=code&scope=${SCOPES.join('%20')}&client_id=${process.env.DOCUSIGN_INTEGRATION_KEY}&redirect_uri=https://www.docusign.com`;
      throw new Error(
        `DocuSign consent required. Please visit: ${consentUrl}`
      );
    }

    throw new Error(
      `Failed to get DocuSign access token: ${error.message || JSON.stringify(error)}`
    );
  }
}

/**
 * Gets an authenticated API client instance
 */
export async function getApiClient(): Promise<docusign.ApiClient> {
  const accessToken = await getAccessToken();
  
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(process.env.DOCUSIGN_API_BASE_URL!);
  apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);
  
  return apiClient;
}

/**
 * Gets the account ID from environment
 */
export function getAccountId(): string {
  if (!process.env.DOCUSIGN_ACCOUNT_ID) {
    throw new Error('DOCUSIGN_ACCOUNT_ID environment variable is not set');
  }
  return process.env.DOCUSIGN_ACCOUNT_ID;
}

/**
 * Clears the token cache (useful for testing or forced refresh)
 */
export function clearTokenCache(): void {
  tokenCache = null;
}
