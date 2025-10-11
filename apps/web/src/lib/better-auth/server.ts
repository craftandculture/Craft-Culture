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
  user: {
    additionalFields: {
      customerType: {
        type: 'string',
        required: true,
        defaultValue: 'b2c',
        input: true,
        fieldName: 'customer_type',
      },
      role: {
        type: 'string',
        required: true,
        defaultValue: 'user',
        input: false,
      },
      onboardingCompletedAt: {
        type: 'date',
        required: false,
        defaultValue: null,
        input: true,
        fieldName: 'onboarding_completed_at',
      },
      pricingModelId: {
        type: 'string',
        required: false,
        defaultValue: null,
        input: true,
        fieldName: 'pricing_model_id',
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          return {
            data: {
              ...user,
              role: serverConfig.adminDomains.some((domain) =>
                user.email.endsWith(`@${domain}`),
              )
                ? 'admin'
                : 'user',
            },
          };
        },
      },
    },
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
