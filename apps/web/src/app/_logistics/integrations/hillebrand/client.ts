import logger from '@/utils/logger';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

// In-memory token cache (consider Redis for production multi-instance)
let tokenCache: TokenCache | null = null;

/* eslint-disable turbo/no-undeclared-env-vars */
const HILLEBRAND_TOKEN_URL = process.env.HILLEBRAND_TOKEN_URL ?? 'https://login.hillebrand.com/oauth2/aus95hq7r8iIqp14M0i7/v1/token';
const HILLEBRAND_API_URL = process.env.HILLEBRAND_API_URL ?? 'https://api.hillebrandgori.com';
const HILLEBRAND_CLIENT_ID = process.env.HILLEBRAND_CLIENT_ID;
const HILLEBRAND_CLIENT_SECRET = process.env.HILLEBRAND_CLIENT_SECRET;
const HILLEBRAND_USERNAME = process.env.HILLEBRAND_USERNAME;
const HILLEBRAND_PASSWORD = process.env.HILLEBRAND_PASSWORD;
/* eslint-enable turbo/no-undeclared-env-vars */

/**
 * Get a new access token using password grant
 */
const getNewAccessToken = async (): Promise<string> => {
  // Debug: Log credential presence and lengths (not values)
  logger.info('Hillebrand auth debug', {
    hasClientId: !!HILLEBRAND_CLIENT_ID,
    clientIdLength: HILLEBRAND_CLIENT_ID?.length,
    clientIdTrimmed: HILLEBRAND_CLIENT_ID?.trim().length,
    hasClientSecret: !!HILLEBRAND_CLIENT_SECRET,
    clientSecretLength: HILLEBRAND_CLIENT_SECRET?.length,
    clientSecretTrimmed: HILLEBRAND_CLIENT_SECRET?.trim().length,
    hasUsername: !!HILLEBRAND_USERNAME,
    usernameLength: HILLEBRAND_USERNAME?.length,
    usernameTrimmed: HILLEBRAND_USERNAME?.trim().length,
    usernameValue: HILLEBRAND_USERNAME?.trim(),
    hasPassword: !!HILLEBRAND_PASSWORD,
    passwordLength: HILLEBRAND_PASSWORD?.length,
    passwordTrimmed: HILLEBRAND_PASSWORD?.trim().length,
    tokenUrl: HILLEBRAND_TOKEN_URL,
  });

  if (!HILLEBRAND_CLIENT_ID || !HILLEBRAND_CLIENT_SECRET || !HILLEBRAND_USERNAME || !HILLEBRAND_PASSWORD) {
    throw new Error('Hillebrand credentials not configured');
  }

  // Use trimmed values to avoid whitespace issues
  const clientId = HILLEBRAND_CLIENT_ID.trim();
  const clientSecret = HILLEBRAND_CLIENT_SECRET.trim();
  const username = HILLEBRAND_USERNAME.trim();
  const password = HILLEBRAND_PASSWORD.trim();

  const params = new URLSearchParams({
    grant_type: 'password',
    username: username,
    password: password,
    scope: 'offline_access',
  });

  const response = await fetch(HILLEBRAND_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to get Hillebrand token', { status: response.status, error: errorText, tokenUrl: HILLEBRAND_TOKEN_URL });
    throw new Error(`Failed to authenticate with Hillebrand: ${response.status}`);
  }

  const data = (await response.json()) as TokenResponse;

  // Cache the token
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    refreshToken: data.refresh_token,
  };

  logger.info('Hillebrand token obtained', { expiresIn: data.expires_in });

  return data.access_token;
};

/**
 * Refresh an access token
 */
const refreshAccessToken = async (refreshToken: string): Promise<string> => {
  if (!HILLEBRAND_CLIENT_ID || !HILLEBRAND_CLIENT_SECRET) {
    throw new Error('Hillebrand credentials not configured');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'offline_access',
  });

  const response = await fetch(HILLEBRAND_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${HILLEBRAND_CLIENT_ID}:${HILLEBRAND_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as TokenResponse;

  // Update cache
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    refreshToken: data.refresh_token ?? refreshToken,
  };

  return data.access_token;
};

/**
 * Get a valid access token, refreshing if needed
 *
 * Token expiry is 8 hours (28800 seconds)
 */
const getAccessToken = async (): Promise<string> => {
  // Check if we have a valid cached token (with 5 min buffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokenCache.accessToken;
  }

  // Try refresh token if available
  if (tokenCache?.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(tokenCache.refreshToken);
      return refreshed;
    } catch (error) {
      logger.warn('Failed to refresh token, getting new one', { error });
    }
  }

  // Get new token via password grant
  return getNewAccessToken();
};

/**
 * Make an authenticated request to the Hillebrand API
 */
const hillebrandFetch = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> => {
  const token = await getAccessToken();

  const url = `${HILLEBRAND_API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Hillebrand API error', { endpoint, status: response.status, error: errorText });
    throw new Error(`Hillebrand API error: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<T>;
};

export { getAccessToken, hillebrandFetch };
