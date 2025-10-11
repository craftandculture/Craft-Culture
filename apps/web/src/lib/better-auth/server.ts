import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { magicLink } from 'better-auth/plugins';

import db from '@/database/client';
import * as schema from '@/database/schema';
import serverConfig from '@/server.config';

import encrypt from '../encryption/encrypt';
import loops from '../loops/client';

const authServerClient = betterAuth({
  baseURL: serverConfig.appUrl.toString(),
  basePath: '/api/v1/auth',
  secret: serverConfig.betterAuthSecret,
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }) => {
        await loops.sendTransactionalEmail({
          transactionalId: '',
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
  socialProviders: {
    // google: {
    //   prompt: 'select_account',
    //   clientId: serverConfig.googleClientId,
    //   clientSecret: serverConfig.googleClientSecret,
    // },
  },
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
    cookiePrefix: 'craft-culture',
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
