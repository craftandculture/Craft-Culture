import { passkeyClient } from '@better-auth/passkey/client';
import {
  adminClient,
  inferAdditionalFields,
} from 'better-auth/client/plugins';
import { magicLinkClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import clientConfig from '@/client.config';

import type authServerClient from './server';

// Use current origin in browser, fall back to config for SSR
const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return clientConfig.appUrl.toString();
};

const authBrowserClient = createAuthClient({
  baseURL: getBaseURL(),
  basePath: '/api/auth',
  plugins: [
    adminClient(),
    passkeyClient(),
    inferAdditionalFields<typeof authServerClient>(),
    magicLinkClient(),
  ],
});

export default authBrowserClient;
