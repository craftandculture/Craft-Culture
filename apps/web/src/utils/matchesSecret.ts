import crypto from 'crypto';

/**
 * Constant-time check of a presented token against a configured secret
 *
 * Both sides are hashed first, so the comparison is always over equal-length
 * buffers and neither the secret's content nor its length leaks through
 * timing. An unset or blank secret never matches: endpoints fail closed.
 *
 * @example
 *   matchesSecret(token, process.env.CRON_SECRET);
 *
 * @param token - The value the caller presented
 * @param secret - The configured secret
 * @returns True only when the secret is set and the token equals it
 */
const matchesSecret = (token: string | null | undefined, secret: string | null | undefined) => {
  const expected = (secret ?? '').trim();
  if (!expected) return false;

  const digest = (value: string) => crypto.createHash('sha256').update(value).digest();

  return crypto.timingSafeEqual(digest((token ?? '').trim()), digest(expected));
};

export default matchesSecret;
