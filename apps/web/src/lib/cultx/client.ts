import openapiFetchCreateClient from 'openapi-fetch';

import type { paths } from './schema';

export interface CultxClientOptions {
  fetch?: (input: Request) => Promise<Response>;
  /** Overrides CULTX_API_BASE_URL */
  baseUrl?: string;
}

/**
 * The CultX Open API base URL for this environment
 *
 * Read from CULTX_API_BASE_URL. There is deliberately no built-in default:
 * the URL that used to be hard-coded was CultX's UAT (test) gateway, and its
 * test prices were being written into live offers. Unset means "do not sync".
 *
 * @returns The configured base URL, or null when none is set
 */
export const getCultxBaseUrl = () => {
  const value = process.env.CULTX_API_BASE_URL?.trim();
  return value ? value.replace(/\/$/, '') : null;
};

const createClient = ({ fetch, baseUrl }: CultxClientOptions = {}) => {
  const resolvedBaseUrl = baseUrl ?? getCultxBaseUrl();

  if (!resolvedBaseUrl) {
    throw new Error('CULTX_API_BASE_URL is not set');
  }

  return openapiFetchCreateClient<paths>({
    baseUrl: resolvedBaseUrl,
    fetch,
  });
};

export type CultxClient = ReturnType<typeof createClient>;

export default createClient;
