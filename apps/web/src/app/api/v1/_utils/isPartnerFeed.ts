import { UNRESTRICTED_FEED_PERMISSION } from '@/app/_partners/schemas/createApiKeySchema';

/**
 * Whether a key gets the restricted partner feed
 *
 * Restricted is the default: only a key that carries `feed:unrestricted` sees
 * owners, offer sources and Private Client prices. Older keys made before
 * `feed:partner` was enforced carry neither flag, and must not read the whole
 * book just because a flag is missing.
 *
 * @example
 *   isPartnerFeed(['read:inventory']); // true
 *   isPartnerFeed(['read:inventory', 'feed:unrestricted']); // false
 *
 * @param permissions - The key's permissions
 * @returns True unless the key is explicitly unrestricted
 */
const isPartnerFeed = (permissions: string[]) =>
  !permissions.includes(UNRESTRICTED_FEED_PERMISSION);

export default isPartnerFeed;
