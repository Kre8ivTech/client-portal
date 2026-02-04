/**
 * QuickBooks Online API Client
 *
 * This module provides utilities for interacting with the QuickBooks Online API.
 * It handles OAuth, token refresh, and API requests.
 *
 * Documentation: https://developer.intuit.com/app/developer/qbo/docs/get-started
 */

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'sandbox' | 'production';
}

export interface QuickBooksTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  x_refresh_token_expires_in: number; // seconds
}

export interface QuickBooksInvoice {
  Id?: string;
  SyncToken?: string;
  DocNumber?: string;
  TxnDate: string; // YYYY-MM-DD
  DueDate: string; // YYYY-MM-DD
  CustomerRef: {
    value: string;
    name?: string;
  };
  Line: Array<{
    DetailType: 'SalesItemLineDetail';
    Amount: number;
    Description?: string;
    SalesItemLineDetail: {
      Qty?: number;
      UnitPrice?: number;
      ItemRef?: {
        value: string;
        name?: string;
      };
    };
  }>;
  TxnTaxDetail?: {
    TotalTax?: number;
  };
  CustomerMemo?: {
    value: string;
  };
}

export interface QuickBooksPayment {
  TotalAmt: number;
  CustomerRef: {
    value: string;
  };
  TxnDate: string; // YYYY-MM-DD
  Line: Array<{
    Amount: number;
    LinkedTxn: Array<{
      TxnId: string;
      TxnType: 'Invoice';
    }>;
  }>;
  PaymentMethodRef?: {
    value: string;
  };
  PaymentRefNum?: string;
  PrivateNote?: string;
}

export class QuickBooksClient {
  private config: QuickBooksConfig;
  private realmId: string;
  private accessToken: string;

  constructor(config: QuickBooksConfig, realmId: string, accessToken: string) {
    this.config = config;
    this.realmId = realmId;
    this.accessToken = accessToken;
  }

  /**
   * Get the base URL for API requests
   */
  private getBaseUrl(): string {
    return this.config.environment === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';
  }

  /**
   * Get the OAuth authorization URL
   */
  static getAuthorizationUrl(config: QuickBooksConfig, state: string): string {
    const baseUrl =
      config.environment === 'sandbox'
        ? 'https://appcenter.intuit.com/connect/oauth2'
        : 'https://appcenter.intuit.com/connect/oauth2';

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      state,
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  static async getTokens(
    config: QuickBooksConfig,
    authorizationCode: string
  ): Promise<QuickBooksTokens> {
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${config.clientId}:${config.clientSecret}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get tokens: ${error}`);
    }

    return response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(
    config: QuickBooksConfig,
    refreshToken: string
  ): Promise<QuickBooksTokens> {
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${config.clientId}:${config.clientSecret}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    return response.json();
  }

  /**
   * Make a GET request to the QuickBooks API
   */
  private async get<T>(endpoint: string): Promise<T> {
    const url = `${this.getBaseUrl()}/v3/company/${this.realmId}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`QuickBooks API error: ${error}`);
    }

    return response.json();
  }

  /**
   * Make a POST request to the QuickBooks API
   */
  private async post<T>(endpoint: string, data: any): Promise<T> {
    const url = `${this.getBaseUrl()}/v3/company/${this.realmId}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`QuickBooks API error: ${error}`);
    }

    return response.json();
  }

  /**
   * Create or update an invoice in QuickBooks
   */
  async createInvoice(invoice: QuickBooksInvoice): Promise<{ Invoice: QuickBooksInvoice }> {
    return this.post('/invoice', invoice);
  }

  /**
   * Get an invoice from QuickBooks
   */
  async getInvoice(invoiceId: string): Promise<{ Invoice: QuickBooksInvoice }> {
    return this.get(`/invoice/${invoiceId}`);
  }

  /**
   * Create a payment in QuickBooks
   */
  async createPayment(payment: QuickBooksPayment): Promise<{ Payment: QuickBooksPayment }> {
    return this.post('/payment', payment);
  }

  /**
   * Get or create a customer in QuickBooks
   */
  async findOrCreateCustomer(
    organizationName: string
  ): Promise<{ Customer: { Id: string; DisplayName: string } }> {
    // First, try to find existing customer
    try {
      const searchResult = await this.get<any>(
        `/query?query=${encodeURIComponent(
          `SELECT * FROM Customer WHERE DisplayName = '${organizationName.replace(/'/g, "\\'")}'`
        )}`
      );

      if (searchResult.QueryResponse?.Customer?.length > 0) {
        return { Customer: searchResult.QueryResponse.Customer[0] };
      }
    } catch (error) {
      console.warn('Error searching for customer:', error);
    }

    // Create new customer if not found
    return this.post('/customer', {
      DisplayName: organizationName,
    });
  }

  /**
   * Test the connection to QuickBooks
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.get('/companyinfo/' + this.realmId);
      return true;
    } catch (error) {
      console.error('QuickBooks connection test failed:', error);
      return false;
    }
  }
}

/**
 * Helper to get QuickBooks config from database or environment variables
 * Tries database first, falls back to environment variables
 */
export async function getQuickBooksConfig(
  supabase?: any,
  organizationId?: string
): Promise<QuickBooksConfig> {
  let clientId: string | undefined;
  let clientSecret: string | undefined;
  let environment: 'sandbox' | 'production' = 'sandbox';

  // Try to get from database if supabase client provided
  if (supabase) {
    try {
      const { data: config } = await supabase.rpc('get_quickbooks_app_config', {
        p_organization_id: organizationId || null,
      });

      if (config && config.length > 0) {
        const dbConfig = config[0];
        clientId = dbConfig.client_id;
        clientSecret = dbConfig.client_secret;
        environment = dbConfig.environment as 'sandbox' | 'production';
      }
    } catch (error) {
      console.warn('Failed to fetch QB config from database, falling back to env vars:', error);
    }
  }

  // Fall back to environment variables if not found in database
  if (!clientId || !clientSecret) {
    clientId = process.env.QUICKBOOKS_CLIENT_ID;
    clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
    const envEnvironment = process.env.QUICKBOOKS_ENVIRONMENT;
    if (envEnvironment === 'production' || envEnvironment === 'sandbox') {
      environment = envEnvironment;
    }
  }

  if (!clientId || !clientSecret) {
    throw new Error('QuickBooks credentials not configured in database or environment variables');
  }

  const redirectUri =
    process.env.QUICKBOOKS_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/quickbooks/callback`;

  return {
    clientId,
    clientSecret,
    redirectUri,
    environment,
  };
}

/**
 * Synchronous helper to get QuickBooks config from environment variables only
 * Used when database access is not available
 */
export function getQuickBooksConfigFromEnv(): QuickBooksConfig {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri =
    process.env.QUICKBOOKS_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/quickbooks/callback`;
  const environment = (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox') as
    | 'sandbox'
    | 'production';

  if (!clientId || !clientSecret) {
    throw new Error('QuickBooks credentials not configured in environment variables');
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    environment,
  };
}
