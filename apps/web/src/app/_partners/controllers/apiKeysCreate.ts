import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partnerApiKeys, partners } from '@/database/schema';
import generateApiKey from '@/lib/apiKeys/generateApiKey';
import { adminProcedure } from '@/lib/trpc/procedures';

import createApiKeySchema, {
  PARTNER_FEED_PERMISSION,
  UNRESTRICTED_FEED_PERMISSION,
} from '../schemas/createApiKeySchema';

/**
 * Create a new API key for a partner
 *
 * Admin-only endpoint. Returns the full key only once - it cannot be retrieved
 * later.
 */
const apiKeysCreate = adminProcedure
  .input(createApiKeySchema)
  .mutation(async ({ input }) => {
    const { partnerId, name, permissions, expiresAt } = input;

    // Verify partner exists
    const [partner] = await db
      .select({ id: partners.id, status: partners.status })
      .from(partners)
      .where(eq(partners.id, partnerId));

    if (!partner) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Partner not found',
      });
    }

    if (partner.status !== 'active') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot create API key for inactive partner',
      });
    }

    /*
      Restricted unless someone deliberately asks otherwise.

      The schema's default only applies when `permissions` is omitted, and the
      Generate Key dialog always sends the array from its checkboxes — so the
      default never fired and a key made from that screen read the whole book:
      both price tiers, and which owner holds what. Enforced here because this
      is the one place a key is minted, so no caller can route around it.

      `feed:unrestricted` is the opt-out, and nothing in the UI can ask for it:
      an unrestricted key is a deliberate act, made on purpose, not the thing
      you get by clicking the obvious button.
    */
    const grantedPermissions = permissions.includes(
      UNRESTRICTED_FEED_PERMISSION,
    )
      ? permissions
      : [...new Set([...permissions, PARTNER_FEED_PERMISSION])];

    // Generate the API key
    const { key, keyHash, keyPrefix } = generateApiKey();

    // Store the key (hashed)
    const [apiKey] = await db
      .insert(partnerApiKeys)
      .values({
        partnerId,
        name,
        keyPrefix,
        keyHash,
        permissions: grantedPermissions,
        expiresAt: expiresAt ?? null,
      })
      .returning({
        id: partnerApiKeys.id,
        name: partnerApiKeys.name,
        keyPrefix: partnerApiKeys.keyPrefix,
        permissions: partnerApiKeys.permissions,
        expiresAt: partnerApiKeys.expiresAt,
        createdAt: partnerApiKeys.createdAt,
      });

    // Return the full key only this once
    return {
      ...apiKey,
      key, // Full key - only returned on creation
    };
  });

export type ApiKeysCreateOutput = Awaited<ReturnType<typeof apiKeysCreate>>;

export default apiKeysCreate;
