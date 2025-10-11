import * as Sentry from '@sentry/nextjs';
import parse from 'another-name-parser';
import bcrypt from 'bcrypt';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { eq } from 'drizzle-orm';
import { after } from 'next/server';

import getWebsiteFromUserEmail from '@/app/_auth/uitls/getWebsiteFromUserEmail';
import db from '@/database';
import * as schema from '@/database/schema';
import { User, users } from '@/database/schema';
import serverConfig from '@/server.config';

import createClient from '../attio/client';
import assertAttioPerson from '../attio/data/assertAttioPerson';
import encrypt from '../encryption/encrypt';
import loops from '../loops/client';
import upsertLoopsContact from '../loops/data/upsertLoopsContact';
import posthog from '../posthog/server';

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

      posthog.capture({
        event: 'user:reset_password_email_sent',
        distinctId: data.user.id,
        properties: {
          ...data.user,
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

      posthog.capture({
        event: 'user:signup_email_sent',
        distinctId: data.user.id,
        properties: {
          ...data.user,
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

        posthog.capture({
          event: 'user:email_change_email_sent',
          distinctId: data.user.id,
          properties: {
            ...data.user,
          },
        });
      },
    },
    additionalFields: {
      phone: {
        type: 'string',
        required: false,
        defaultValue: null,
        input: true,
      },
      roleAtOrganization: {
        type: 'string',
        required: false,
        defaultValue: null,
        input: true,
      },
      referralSource: {
        type: 'string',
        required: false,
        defaultValue: null,
        input: true,
      },
      onboardingStep: {
        type: 'string',
        required: true,
        defaultValue: 'profile',
        input: false,
      },
    },
  },
  socialProviders: {
    google: {
      prompt: 'select_account',
      clientId: serverConfig.googleClientId,
      clientSecret: serverConfig.googleClientSecret,
    },
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
    user: {
      create: {
        after: async (user) => {
          posthog.capture({
            event: 'user:created',
            distinctId: user.id,
            properties: {
              ...user,
            },
          });

          after(async () => {
            const attio = createClient({
              apiKey: serverConfig.attioApiKey,
            });

            try {
              const [attioPersonId] = await Promise.all([
                serverConfig.enableAttioSync
                  ? assertAttioPerson({
                      client: attio,
                      properties: {
                        userId: user.id,
                        email: user.email,
                        name: user.name,
                        phone: (user as User).phone,
                        roleAtOrganization: (user as User).roleAtOrganization,
                        referralSource: (user as User).referralSource,
                        companyWebsite: getWebsiteFromUserEmail(user.email),
                      },
                    })
                  : Promise.resolve(null),
                serverConfig.enableLoopsSync
                  ? upsertLoopsContact(user.email, {
                      lifecycleStage: 'lead',
                      organizationCount: 0,
                      administrationCount: 0,
                    })
                  : Promise.resolve(),
              ]);
              if (!attioPersonId) return;

              await db
                .update(users)
                .set({
                  attioPersonId,
                })
                .where(eq(users.id, user.id));
            } catch (error) {
              Sentry.captureException(error);
            }
          });
        },
      },
      update: {
        after: async (user) => {
          posthog.capture({
            event: 'user:updated',
            distinctId: user.id,
            properties: {
              ...user,
            },
          });

          if (!serverConfig.enableAttioSync) return;

          after(async () => {
            try {
              const attio = createClient({
                apiKey: serverConfig.attioApiKey,
              });

              await assertAttioPerson({
                client: attio,
                properties: {
                  userId: user.id,
                  email: user.email,
                  name: user.name,
                  phone: (user as User).phone,
                  roleAtOrganization: (user as User).roleAtOrganization,
                  referralSource: (user as User).referralSource,
                  companyWebsite: getWebsiteFromUserEmail(user.email),
                },
              });
            } catch (error) {
              Sentry.captureException(error);
            }
          });
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          posthog.capture({
            event: 'user:logged_in',
            distinctId: session.userId,
          });
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
