import parseCityDrinksStock from '../utils/parseCityDrinksStock';
import type { ParsedCityDrinksStock } from '../utils/parseCityDrinksStock';

/** Long enough for a 400kb payload, short enough not to wedge a scheduled run */
const TIMEOUT_MS = 30_000;

export interface OutletConnector {
  name: string;
  apiUrl: string | null;
  apiTokenEnv: string | null;
}

/**
 * Pull an outlet's live stock position
 *
 * The token is read from the environment variable the outlet names, never from
 * the database — a credential stored in a row is a credential in every backup
 * of that row.
 *
 * Refuses rather than returning nothing when it cannot be configured. The Zoho
 * jobs once carried a silent `not_configured` skip that froze the invoice sync
 * for ten days while every screen went on showing its last good figures, so a
 * feed that cannot run says so loudly.
 *
 * @param outlet - The outlet's connector settings
 * @returns The parsed snapshot
 */
const fetchCityDrinksStock = async (
  outlet: OutletConnector,
): Promise<ParsedCityDrinksStock> => {
  if (!outlet.apiUrl) {
    throw new Error(`${outlet.name} has no API url configured`);
  }

  if (!outlet.apiTokenEnv) {
    throw new Error(`${outlet.name} does not name an API token variable`);
  }

  const token = process.env[outlet.apiTokenEnv];

  if (!token) {
    throw new Error(
      `${outlet.apiTokenEnv} is not set. Add it in Vercel AND in Trigger.dev — their environments are separate, and Trigger.dev only picks it up on redeploy.`,
    );
  }

  const url = new URL(outlet.apiUrl);

  url.searchParams.set('token', token);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `${outlet.name} returned ${response.status} ${response.statusText}`,
      );
    }

    const payload = await response.json();

    return parseCityDrinksStock(payload);
  } finally {
    clearTimeout(timeout);
  }
};

export default fetchCityDrinksStock;
