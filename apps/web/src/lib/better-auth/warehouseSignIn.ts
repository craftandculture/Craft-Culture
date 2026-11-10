import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { z } from 'zod';

import postWarehouseSlack from '@/app/_wms/utils/postWarehouseSlack';
import { checkScannerPin } from '@/app/_wms/utils/scannerPin';
import { WMS_DEVICE_COOKIE, WMS_DEVICE_COOKIE_MAX_AGE_SECONDS } from '@/lib/wms/deviceTokenCookie';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';
import matchesSecret from '@/utils/matchesSecret';

import { GLOBAL_PIN_FAILURES, pinSignInClosedFor, recordPinFailure } from './pinFailureLimit';

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
 * address, and also across all addresses together (see pinFailureLimit), so
 * guesses spread over many addresses still run out. The device token is not
 * under the global limit, so a scanner holding its cookie is never locked out
 * by someone else's guessing.
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

          // Checked before the PIN, so a correct guess made while closed is not let through
          if (!deviceToken) {
            const closedFor = await pinSignInClosedFor();
            if (closedFor !== null) {
              logger.warn('[Warehouse sign-in] PIN refused: too many wrong PINs this hour', { closedFor });
              throw new APIError('TOO_MANY_REQUESTS', {
                message: `PIN sign-in is paused after too many wrong PINs. Try again in ${Math.ceil(closedFor / 60)} minutes.`,
              });
            }
          }

          const allowed = deviceToken
            ? Boolean(expectedToken && matchesSecret(deviceToken.trim(), expectedToken))
            : await checkScannerPin(pin?.trim() ?? '');
          if (!allowed) {
            logger.warn('[Warehouse sign-in] Refused', { by: deviceToken ? 'device token' : 'PIN' });
            if (!deviceToken) {
              const failures = await recordPinFailure();
              // Exactly at the limit, so the alert goes once per window rather than on every later guess
              if (failures === GLOBAL_PIN_FAILURES) {
                logger.error('[Warehouse sign-in] PIN sign-in closed for the hour after repeated wrong PINs', {
                  failures,
                });
                await postWarehouseSlack(
                  `:rotating_light: Warehouse PIN sign-in has been paused for an hour after ${failures} wrong PINs. ` +
                    'Scanners already signed in, or holding their device cookie, are not affected. ' +
                    'If this was not staff, change the scanner PIN under Platform Settings.',
                );
              }
            }
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
