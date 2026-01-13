import { getCookie } from 'cookies-next/client';
import { z } from 'zod';

import logger from '@/utils/logger';

export const cookieSchema = z.object({
  consented: z.boolean().optional().default(false),
  preferences: z.boolean().optional().default(false),
  analytics: z.boolean().optional().default(false),
  marketing: z.boolean().optional().default(false),
});

const getConsentFromCookie = (cookieName: string) => {
  try {
    return cookieSchema.parse(JSON.parse(getCookie(cookieName) ?? '{}'));
  } catch {
    logger.error('Error parsing consent cookie');
    return cookieSchema.parse({});
  }
};

export type CookieConsent = z.infer<typeof cookieSchema>;

export default getConsentFromCookie;
