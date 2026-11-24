import z from 'zod';

/**
 * What a key issued from the Partners screen may see.
 *
 * `feed:partner` is the restricted shape a partner builds pre-orders on: trade
 * pricing only, and every line presented as Craft & Culture. It is the DEFAULT
 * because the alternative — a key that happens to omit it — reads the whole
 * book: both price tiers and which owner holds what. A distributor key created
 * without thinking must not be the permissive one.
 *
 * Keys that legitimately need the unrestricted view (the consumer portals,
 * which serve Private Client prices) are created without `feed:partner`.
 */
export const PARTNER_FEED_PERMISSION = 'feed:partner';

/**
 * Opt-out, applied by `apiKeysCreate` and askable only in code.
 *
 * The consumer portals hold such a key: they serve Private Client prices, which
 * is exactly what the partner feed withholds.
 */
export const UNRESTRICTED_FEED_PERMISSION = 'feed:unrestricted';

/**
 * The key holder's OWN stock: holdings, movements, sales and reservations
 *
 * Every answer under `/api/v1/account/*` is scoped to the partner the key was
 * issued to, server-side, from the key itself. There is no parameter that
 * names an owner, so no key can ask for anyone else's wine.
 */
export const OWN_STOCK_PERMISSION = 'read:own_stock';

/**
 * The only permissions a key minted from the Partners screen may carry.
 *
 * Anything else — `feed:unrestricted` included, or a typo that some future
 * check might read as meaningful — is rejected at the door. An unrestricted
 * key is issued outside the app, deliberately, never through this endpoint.
 */
export const GRANTABLE_PERMISSIONS = [
  'read:inventory',
  OWN_STOCK_PERMISSION,
  PARTNER_FEED_PERMISSION,
] as const;

const createApiKeySchema = z.object({
  partnerId: z.string().uuid(),
  name: z.string().min(1, 'API key name is required'),
  permissions: z
    .array(z.enum(GRANTABLE_PERMISSIONS))
    .default(['read:inventory', PARTNER_FEED_PERMISSION]),
  expiresAt: z.date().optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export default createApiKeySchema;
