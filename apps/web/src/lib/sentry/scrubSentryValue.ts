import scrubSentryString from './scrubSentryString';

/** Keys whose value is withheld outright, whatever it looks like */
const SENSITIVE_KEY =
  /^(password|passwd|pass|secret|client_secret|token|access_token|refresh_token|id_token|otp|authorization|cookie|cookies|set-cookie|x-api-key|api_key|apikey|invite|file|filedata|document|identity\w*|emirates\w*|passport\w*|iban|account_?number|card\w*)$/i;

const MAX_DEPTH = 12;

/**
 * Deep-clean any value bound for Sentry
 *
 * Strings go through `scrubSentryString`; values under a sensitive key are
 * replaced whole, so an identity upload or a credential never leaves, even
 * when it is not shaped like anything the string patterns recognise. Beyond
 * MAX_DEPTH the value is dropped rather than sent unexamined.
 *
 * @example
 *   scrubSentryValue({ token: 'abc', url: '/join?invite=x' });
 *   // { token: '[Filtered]', url: '/join?invite=[Filtered]' }
 *
 * @param value - Anything: an event, a breadcrumb, a log
 * @param depth - Recursion depth, for internal use
 * @returns A cleaned copy
 */
const scrubSentryValue = <T>(value: T, depth = 0): T => {
  if (typeof value === 'string') {
    return scrubSentryString(value) as T;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (depth > MAX_DEPTH) {
    return '[Truncated]' as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubSentryValue(item, depth + 1)) as T;
  }

  const cleaned: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    cleaned[key] = SENSITIVE_KEY.test(key)
      ? '[Filtered]'
      : scrubSentryValue(item, depth + 1);
  }

  return cleaned as T;
};

export default scrubSentryValue;
