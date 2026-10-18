const DATA_URL = /data:[a-z0-9.+/-]*(?:;[a-z0-9=.-]+)*;base64,[a-z0-9+/=]+/gi;

/*
  Every query or fragment value, whatever its name. A list of "sensitive"
  parameter names is a list of the leaks someone has already thought of: the
  magic-link token, the cellar invite and tRPC's GET `input` (which carries the
  whole query, search terms and all) each have a different name.
*/
const QUERY_VALUE = /([?&#;][^=&#?\s"'<>]+)=[^&#\s"'<>]*/g;

/** Client quote links are unguessable slugs: the address is the key */
const QUOTE_SLUG = /(\/q\/)[^/?#\s"'<>]+/g;

const BEARER = /(bearer\s+)[a-z0-9._~+/-]+=*/gi;

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

const EMIRATES_ID = /\b784-?\d{4}-?\d{7}-?\d\b/g;

/**
 * Remove secrets and personal data from one string bound for Sentry
 *
 * Applied to every string in an event, breadcrumb, trace or log rather than
 * to the fields known to hold URLs, because Sentry copies a URL into several
 * places (request, breadcrumbs, span descriptions, transaction names) and a
 * scrubber that misses one of them leaks the token anyway.
 *
 * @example
 *   scrubSentryString('/auth/verify?token=abc'); // '/auth/verify?token=[Filtered]'
 *
 * @param value - The string to clean
 * @returns The string with query values, quote slugs, bearer tokens, email
 *   addresses, Emirates ID numbers and embedded files replaced
 */
const scrubSentryString = (value: string) => {
  return value
    .replace(DATA_URL, '[file removed]')
    .replace(QUERY_VALUE, '$1=[Filtered]')
    .replace(QUOTE_SLUG, '$1[slug]')
    .replace(BEARER, '$1[Filtered]')
    .replace(EMAIL, '[email]')
    .replace(EMIRATES_ID, '[id number]');
};

export default scrubSentryString;
