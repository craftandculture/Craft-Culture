import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { magicLink } from 'better-auth/plugins';

import clientConfig from '@/client.config';
import db from '@/database/client';
import * as schema from '@/database/schema';
import serverConfig from '@/server.config';

import encrypt from '../encryption/encrypt';
import loops from '../loops/client';

const authServerClient = betterAuth({
  baseURL: serverConfig.appUrl.toString(),
  basePath: '/api/auth',
  secret: serverConfig.betterAuthSecret,
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }) => {
        if (serverConfig.env !== 'production') {
          console.log('You are in development mode, so no email will be sent');
          console.log(email);
          console.log(token);
          console.log(url);
          return;
        }

        await loops.sendTransactionalEmail({
          transactionalId: 'cmglxdfzwzzscz00inq1dm56c',
          email,
          dataVariables: {
            token,
            url,
          },
        });
      },
    }),
    nextCookies(),
  ],
  socialProviders: {},
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
    cookiePrefix: clientConfig.cookiePrefix,
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
    schema,
  }),
  databaseHooks: {
    account: {
      create: {
        before: async (account) => {
          const withEncryptedTokens = { ...account };

          if (account.accessToken) {
            withEncryptedTokens.accessToken = encrypt(
              account.accessToken,
              serverConfig.encryptionKeyBuffer,
            );
          }

          if (account.refreshToken) {
            withEncryptedTokens.refreshToken = encrypt(
              account.refreshToken,
              serverConfig.encryptionKeyBuffer,
            );
          }

          return {
            data: withEncryptedTokens,
          };
        },
      },
    },
  },
});

export default authServerClient;
