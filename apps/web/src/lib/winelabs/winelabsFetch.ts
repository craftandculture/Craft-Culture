import db from '@/database/client';
import { winelabsCalls } from '@/database/schema';
import serverConfig from '@/server.config';

import endpointCredits from './endpointCredits';
import type { WinelabsEndpoint } from './endpointCredits';
import getWinelabsCreditsThisMonth from './getWinelabsCreditsThisMonth';
import isWinelabsConfigured from './isWinelabsConfigured';
import WinelabsCapError from './WinelabsCapError';

/**
 * Call one Wine Labs endpoint, within the month's credit cap
 *
 * Every call is logged with the credits it cost, which is what the cap and
 * the spend shown on screen are counted from. A 404 is Wine Labs saying it
 * has no answer for this wine, so it returns null rather than throwing.
 *
 * @example
 *   await winelabsFetch('match_to_lwin', { query: 'Opus One 2019' });
 *
 * @param endpoint - The endpoint, without a leading slash
 * @param body - The request body; the account's user_id is added here
 * @returns The parsed JSON response, or null when Wine Labs has no answer
 */
const winelabsFetch = async (endpoint: WinelabsEndpoint, body: Record<string, unknown>) => {
  if (!isWinelabsConfigured()) {
    throw new Error('Wine Labs is not configured: set WINELABS_USER_ID');
  }

  const credits = endpointCredits[endpoint];
  const cap = serverConfig.winelabsMonthlyCreditCap;
  const spent = await getWinelabsCreditsThisMonth();
  if (spent + credits > cap) {
    throw new WinelabsCapError(spent, cap);
  }

  // A stray newline pasted into an env var breaks auth silently; no key has whitespace
  const userId = (serverConfig.winelabsUserId ?? '').replace(/\s/g, '');
  const baseUrl = serverConfig.winelabsBaseUrl.replace(/\/+$/, '');

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...body, user_id: userId }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.insert(winelabsCalls).values({ endpoint, credits: 0, status: 0, error: message });
    throw new Error(`Wine Labs ${endpoint} unreachable: ${message}`);
  }

  if (response.status === 404) {
    await db.insert(winelabsCalls).values({ endpoint, credits: 0, status: 404 });
    return null;
  }

  if (!response.ok) {
    const text = (await response.text()).slice(0, 300);
    await db.insert(winelabsCalls).values({ endpoint, credits: 0, status: response.status, error: text });
    throw new Error(`Wine Labs ${endpoint} failed (${response.status}): ${text}`);
  }

  await db.insert(winelabsCalls).values({ endpoint, credits, status: response.status });
  return (await response.json()) as unknown;
};

export default winelabsFetch;
