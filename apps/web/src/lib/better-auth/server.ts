import parse from 'another-name-parser';
import bcrypt from 'bcrypt';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';

import db from '@/database';
import * as schema from '@/database/schema';
import serverConfig from '@/server.config';

import encrypt from '../encryption/encrypt';
import loops from '../loops/client';

const authServerClient = betterAuth({
  baseURL: serverConfig.appUrl.toString(),
  basePath: '/api/v1/auth',
  secret: serverConfig.betterAuthSecret,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword(data) {
      await loops.sendTransactionalEmail({
        transactionalId: 'cmbddd0xj0i5u230hghxozg5g',
        email: data.user.email,
        dataVariables: {
          first_name: parse(data.user.name).first ?? data.user.name,
          email: data.user.email,
          confirmation_link: data.url,
        },
      });
    },
    password: {
      hash: async (password: string) => {
        return await bcrypt.hash(password, 10);
      },
      verify: async ({ password, hash }) => {
        return await bcrypt.compare(password, hash);
      },
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail(data) {
      await loops.sendTransactionalEmail({
        transactionalId: 'cmbbw5oic2jdv1m0imz1kae3l',
        email: data.user.email,
        dataVariables: {
          name: data.user.name,
          email: data.user.email,
          confirmation_link: data.url,
        },
      });
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      async sendChangeEmailVerification(data) {
        await loops.sendTransactionalEmail({
          transactionalId: 'cmbdlx37j2mic080jv44bylio',
          email: data.newEmail,
          dataVariables: {
            email: data.user.email,
            old_email: data.user.email,
            new_email: data.newEmail,
            first_name: parse(data.user.name).first ?? data.user.name,
            confirmation_link: data.url,
          },
        });
      },
    },
    additionalFields: {},
  },
  socialProviders: {
    // google: {
    //   prompt: 'select_account',
    //   clientId: serverConfig.googleClientId,
    //   clientSecret: serverConfig.googleClientSecret,
    // },
  },
  plugins: [nextCookies()],
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
    cookiePrefix: 'easybooker',
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
