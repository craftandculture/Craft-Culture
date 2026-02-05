/**
 * Zoho Books API Client
 *
 * OAuth2 client with automatic token refresh for Zoho Books API.
 * Uses refresh_token grant type since we have a pre-authorized refresh token.
 *
 * @see https://www.zoho.com/books/api/v3/oauth/
 */

import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import type { ZohoTokenResponse } from './types';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

// In-memory token cache
let tokenCache: TokenCache | null = null;

/**
 * Get Zoho API URLs based on configured region
 * - us: zoho.com (default)
 * - eu: zoho.eu (UAE/Europe)
 * - in: zoho.in (India)
 * - au: zoho.com.au (Australia)
 */
const getZohoUrls = () => {
  const region = serverConfig.zohoRegion || 'us';
  const domains: Record<string, { accounts: string; api: string }> = {
    us: {
      accounts: 'https://accounts.zoho.com',
      api: 'https://www.zohoapis.com/books/v3',
    },
    eu: {
      accounts: 'https://accounts.zoho.eu',
      api: 'https://www.zohoapis.eu/books/v3',
    },
    in: {
      accounts: 'https://accounts.zoho.in',
      api: 'https://www.zohoapis.in/books/v3',
    },
    au: {
      accounts: 'https://accounts.zoho.com.au',
      api: 'https://www.zohoapis.com.au/books/v3',
    },
  };
  return domains[region] || domains.us;
};

/**
 * Check if Zoho integration is configured
 */
const isZohoConfigured = () => {
  return !!(
    serverConfig.zohoClientId &&
    serverConfig.zohoClientSecret &&
    serverConfig.zohoRefreshToken &&
    serverConfig.zohoOrganizationId
  );
};

/**
 * Refresh the access token using the stored refresh token
 */
const refreshAccessToken = async (): Promise<string> => {
  if (!isZohoConfigured()) {
    throw new Error('Zoho credentials not configured');
  }

  // Trim all credentials to remove any trailing newlines from env vars
  const clientId = serverConfig.zohoClientId!.trim();
  const clientSecret = serverConfig.zohoClientSecret!.trim();
  const refreshToken = serverConfig.zohoRefreshToken!.trim();

  logger.info('Zoho token refresh starting', {
    clientIdPreview: `${clientId.slice(0, 10)}...${clientId.slice(-4)}`,
    refreshTokenPreview: `${refreshToken.slice(0, 10)}...${refreshToken.slice(-4)}`,
  });

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const { accounts: accountsUrl } = getZohoUrls();
  const tokenUrl = `${accountsUrl}/oauth/v2/token`;

  logger.info('Zoho token refresh request', { url: tokenUrl });

  // Add 30 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    logger.info('Zoho token refresh response received', { status: response.status });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to refresh Zoho token', {
        status: response.status,
        error: errorText,
      });
      throw new Error(`Failed to refresh Zoho token: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as ZohoTokenResponse;

    logger.info('Zoho token response parsed', {
      hasAccessToken: !!data.access_token,
      expiresIn: data.expires_in,
    });

    // Cache the token (Zoho tokens expire in 1 hour = 3600 seconds)
    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };

    logger.info('Zoho token refreshed successfully', { expiresIn: data.expires_in });

    return data.access_token;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('Zoho token refresh timeout after 30s');
      throw new Error('Zoho token refresh timed out');
    }
    throw error;
  }
};

/**
 * Get a valid access token, refreshing if needed
 */
const getAccessToken = async (): Promise<string> => {
  // Check if we have a valid cached token (with 5 min buffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokenCache.accessToken;
  }

  // Refresh the token
  return refreshAccessToken();
};

/**
 * Make an authenticated request to the Zoho Books API
 */
const zohoFetch = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> => {
  if (!isZohoConfigured()) {
    throw new Error('Zoho integration not configured');
  }

  const token = await getAccessToken();

  // Build URL with organization_id
  const { api: apiUrl } = getZohoUrls();
  const url = new URL(`${apiUrl}${endpoint}`);
  const orgId = serverConfig.zohoOrganizationId!.trim();
  url.searchParams.set('organization_id', orgId);

  logger.info('Zoho API request', {
    endpoint,
    apiUrl,
    orgId,
    region: serverConfig.zohoRegion,
    fullUrl: url.toString(),
  });

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Zoho-oauthtoken ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Zoho API error', {
      endpoint,
      status: response.status,
      error: errorText,
    });
    throw new Error(`Zoho API error: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<T>;
};

export { getAccessToken, isZohoConfigured, zohoFetch };
