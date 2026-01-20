import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { admin, magicLink } from 'better-auth/plugins';

import notifyAdminsOfNewUser from '@/app/_auth/utils/notifyAdminsOfNewUser';
import clientConfig from '@/client.config';
import db from '@/database/client';
import * as schema from '@/database/schema';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';
import logUserActivity from '@/utils/logUserActivity';

import encrypt from '../encryption/encrypt';
import loops from '../loops/client';

const isVercelProduction = process.env.VERCEL_ENV === 'production';

const authServerClient = betterAuth({
  baseURL: isVercelProduction
    ? 'https://wine.craftculture.xyz'
    : serverConfig.appUrl.toString(),
  basePath: '/api/auth',
  secret: serverConfig.betterAuthSecret,
  plugins: [
    admin({
      impersonationSessionDuration: 60 * 60, // 1 hour
    }),
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
    passkey({
      rpName: 'Craft & Culture',
      rpID: isVercelProduction ? 'craftculture.xyz' : 'localhost',
      origin: isVercelProduction
        ? 'https://wine.craftculture.xyz'
        : 'http://localhost:3000',
      advanced: {
        webAuthnChallengeCookie: 'craft-culture.passkey-challenge',
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
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: isVercelProduction,
      httpOnly: true,
    },
  },
  trustedOrigins: isVercelProduction
    ? [
        'https://wine.craftculture.xyz',
        'https://www.wine.craftculture.xyz',
        'https://craft-culture.vercel.app',
        'https://warehouse.craftculture.xyz',
        // Allow all craftculture.xyz subdomains
        /^https:\/\/.*\.craftculture\.xyz$/,
        // Allow all Vercel preview deployments
        /^https:\/\/craft-culture.*\.vercel\.app$/,
      ]
    : ['http://localhost:3000'],
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
          try {
            logger.info('[Better Auth] User creation started', {
              email: user.email,
              hasName: !!user.name,
              name: user.name,
            });

            const isAdmin = serverConfig.adminDomains.some((domain) =>
              user.email.endsWith(`@${domain}`),
            );

            // If name is empty, use the email prefix as the name
            // This prevents database errors when Better Auth doesn't provide a name
            const name = user.name?.trim() || user.email.split('@')[0];

            return {
              data: {
                ...user,
                name,
                role: isAdmin ? 'admin' : 'user',
                approvalStatus: isAdmin ? 'approved' : 'pending',
              },
            };
          } catch (error) {
            logger.error('[Better Auth] Error in user.create.before hook', {
              error,
              email: user.email,
            });
            throw error;
          }
        },
        after: async (user) => {
          logger.info('[Better Auth] User created successfully', {
            userId: user.id,
            email: user.email,
            role: user.role,
            approvalStatus: user.approvalStatus,
          });

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
