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

const createApiKeySchema = z.object({
  partnerId: z.string().uuid(),
  name: z.string().min(1, 'API key name is required'),
  permissions: z
    .array(z.string())
    .default(['read:inventory', PARTNER_FEED_PERMISSION]),
  expiresAt: z.date().optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export default createApiKeySchema;
