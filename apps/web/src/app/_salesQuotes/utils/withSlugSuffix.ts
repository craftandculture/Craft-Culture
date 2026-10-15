import { randomInt } from 'node:crypto';

/** Lowercase letters and digits minus the look-alikes (0/o, 1/l) */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

const SUFFIX_LENGTH = 8;

/** A trailing segment this helper would have produced: 8 chars, letters and digits mixed */
const HAS_SUFFIX = new RegExp(`-(?=[^-]*\\d)(?=[^-]*[a-z])[${ALPHABET}]{${SUFFIX_LENGTH}}$`);

/** The slug schema's maximum length */
const MAX_SLUG = 80;

/**
 * Append a random suffix to a new quote's public slug
 *
 * A published quote is reachable by anyone holding its /q/<slug> link, and a
 * readable slug such as `tbs-october` is easy to guess. Eight random
 * characters (32^8, about 10^12) make the link unguessable while keeping the
 * readable part. Slugs that already end in such a suffix are left alone, so
 * saving twice does not stack them.
 *
 * @example
 *   withSlugSuffix('tbs-october'); // 'tbs-october-k7m2qx9a'
 *
 * @param slug - The slug the admin typed
 * @returns The slug with a random suffix
 */
const withSlugSuffix = (slug: string) => {
  if (HAS_SUFFIX.test(slug)) return slug;

  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }

  const base = slug.slice(0, MAX_SLUG - SUFFIX_LENGTH - 1).replace(/-+$/, '');

  return `${base}-${suffix}`;
};

export default withSlugSuffix;
