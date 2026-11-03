import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { z } from 'zod';

import { checkScannerPin } from '@/app/_wms/utils/scannerPin';
import { WMS_DEVICE_COOKIE, WMS_DEVICE_COOKIE_MAX_AGE_SECONDS } from '@/lib/wms/deviceTokenCookie';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';
import matchesSecret from '@/utils/matchesSecret';

/** The shared warehouse login, when WMS_DEVICE_USER_EMAIL is not set */
const WAREHOUSE_EMAIL = 'warehouse@craftculture.xyz';

/** Wrong PINs a scanner may try before it must wait */
const ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;

/**
 * Sign a warehouse scanner in as the shared warehouse login
 *
 * Takes the six-digit scanner PIN staff set under Platform Settings, or the
 * device token (from the device cookie, when a scanner's session has lapsed).
 * The session is made by Better Auth itself, so its cookie is signed like any
 * other. The device cookie is set alongside it, so middleware can sign the
 * scanner back in by itself when the session ends. Wrong PINs are limited per
 * address.
 */
const warehouseSignIn = () =>
  ({
    id: 'warehouse-sign-in',
    endpoints: {
      warehouseSignIn: createAuthEndpoint(
        '/warehouse/sign-in',
        {
          method: 'POST',
          body: z.object({ pin: z.string().optional(), deviceToken: z.string().optional() }),
        },
        async (ctx) => {
          const { pin, deviceToken } = ctx.body;
          const expectedToken = serverConfig.wmsDeviceToken?.trim();
          const allowed = deviceToken
            ? Boolean(expectedToken && matchesSecret(deviceToken.trim(), expectedToken))
            : await checkScannerPin(pin?.trim() ?? '');
          if (!allowed) {
            logger.warn('[Warehouse sign-in] Refused', { by: deviceToken ? 'device token' : 'PIN' });
            throw new APIError('UNAUTHORIZED', { message: deviceToken ? 'Invalid device token' : 'That PIN is not right' });
          }

          const email = serverConfig.wmsDeviceUserEmail?.trim() || WAREHOUSE_EMAIL;
          const found = await ctx.context.internalAdapter.findUserByEmail(email);
          if (!found) {
            logger.error('[Warehouse sign-in] Warehouse login not found', { email });
            throw new APIError('NOT_FOUND', { message: 'The warehouse login does not exist' });
          }

          const session = await ctx.context.internalAdapter.createSession(found.user.id, false);
          await setSessionCookie(ctx, { session, user: found.user });
          if (expectedToken) {
            ctx.setCookie(WMS_DEVICE_COOKIE, expectedToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              maxAge: WMS_DEVICE_COOKIE_MAX_AGE_SECONDS,
            });
          }
          logger.info('[Warehouse sign-in] Signed in', { by: deviceToken ? 'device token' : 'PIN', userId: found.user.id });
          return ctx.json({ ok: true });
        },
      ),
    },
    rateLimit: [
      { pathMatcher: (path: string) => path === '/warehouse/sign-in', window: WINDOW_SECONDS, max: ATTEMPTS },
    ],
  }) satisfies BetterAuthPlugin;

export default warehouseSignIn;
