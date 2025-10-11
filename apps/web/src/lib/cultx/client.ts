import openapiFetchCreateClient from 'openapi-fetch';

import type { paths } from './schema';

export interface CultxClientOptions {
  fetch?: (input: Request) => Promise<Response>;
}

const createClient = ({ fetch }: CultxClientOptions = {}) => {
  return openapiFetchCreateClient<paths>({
    baseUrl: 'https://cw-fo-uat-apim.azure-api.net/cultx-open-api',
    fetch,
  });
};

export type CultxClient = ReturnType<typeof createClient>;

export default createClient;
