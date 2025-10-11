import {
  inferAdditionalFields,
  passkeyClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import clientConfig from '@/client.config';

import type authServerClient from './server';

const authBrowserClient = createAuthClient({
  baseURL: clientConfig.appUrl.toString(),
  basePath: '/api/auth',
  plugins: [passkeyClient(), inferAdditionalFields<typeof authServerClient>()],
});

export default authBrowserClient;
