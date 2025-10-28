import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { magicLink } from 'better-auth/plugins';

import notifyAdminsOfNewUser from '@/app/_auth/utils/notifyAdminsOfNewUser';
import clientConfig from '@/client.config';
import db from '@/database/client';
import * as schema from '@/database/schema';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';
import logUserActivity from '@/utils/logUserActivity';

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
          logger.dev('You are in development mode, so no email will be sent');
          logger.dev('Email:', email);
          logger.dev('Token:', token);
          logger.dev('URL:', url);
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
      },
      pricingModelId: {
        type: 'string',
        required: false,
        defaultValue: null,
        input: true,
      },
      approvalStatus: {
        type: 'string',
        required: true,
        defaultValue: 'pending',
        input: false,
      },
      approvedAt: {
        type: 'date',
        required: false,
        defaultValue: null,
        input: false,
      },
      approvedBy: {
        type: 'string',
        required: false,
        defaultValue: null,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const isAdmin = serverConfig.adminDomains.some((domain) =>
            user.email.endsWith(`@${domain}`),
          );

          return {
            data: {
              ...user,
              role: isAdmin ? 'admin' : 'user',
              approvalStatus: isAdmin ? 'approved' : 'pending',
            },
          };
        },
        after: async (user) => {
          // Log new user signup for admin monitoring
          void logUserActivity({
            userId: user.id,
            action: 'user.signup',
            entityType: 'user',
            entityId: user.id,
            ipAddress: null,
            userAgent: null,
            metadata: {
              email: user.email,
              customerType: user.customerType,
              role: user.role,
              approvalStatus: user.approvalStatus,
            },
          });

          // Notify admins if user needs approval
          if (user.approvalStatus === 'pending') {
            void notifyAdminsOfNewUser({
              id: user.id,
              email: user.email,
              name: user.name,
              customerType: user.customerType as string,
              createdAt: user.createdAt as Date,
            });
          }
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
    session: {
      create: {
        after: async (session) => {
          // Log all user sign-ins for admin monitoring
          void logUserActivity({
            userId: session.userId,
            action: 'user.signin',
            entityType: 'session',
            entityId: session.id,
            ipAddress: session.ipAddress ?? null,
            userAgent: session.userAgent ?? null,
            metadata: {
              sessionId: session.id,
            },
          });
        },
      },
    },
  },
});

export default authServerClient;
