import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import db from '@/database/client';
import { partnerApiKeys, partners } from '@/database/schema';
import validateApiKeyHash from '@/lib/apiKeys/validateApiKeyHash';

interface ValidatedApiKey {
  apiKeyId: string;
  partnerId: string;
  permissions: string[];
}

type ValidationResult =
  | { success: true; data: ValidatedApiKey }
  | { success: false; error: NextResponse };

/**
 * Validates an API key from the Authorization header
 *
 * @example
 *   const result = await validateApiKey(request);
 *   if (!result.success) return result.error;
 *   const { apiKeyId, partnerId, permissions } = result.data;
 */
const validateApiKey = async (request: NextRequest): Promise<ValidationResult> => {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 },
      ),
    };
  }

  const providedKey = authHeader.substring(7);

  if (!providedKey || providedKey.length < 12) {
    return {
      success: false,
      error: NextResponse.json({ error: 'Invalid API key format' }, { status: 401 }),
    };
  }

  // Extract prefix to narrow down search
  const keyPrefix = providedKey.substring(0, 12);

  // Find API keys with matching prefix that are not revoked and not expired
  const apiKeys = await db
    .select({
      id: partnerApiKeys.id,
      partnerId: partnerApiKeys.partnerId,
      keyHash: partnerApiKeys.keyHash,
      permissions: partnerApiKeys.permissions,
      expiresAt: partnerApiKeys.expiresAt,
      partnerStatus: partners.status,
    })
    .from(partnerApiKeys)
    .innerJoin(partners, eq(partnerApiKeys.partnerId, partners.id))
    .where(
      and(
        eq(partnerApiKeys.keyPrefix, keyPrefix),
        eq(partnerApiKeys.isRevoked, false),
        eq(partners.status, 'active'),
        or(
          isNull(partnerApiKeys.expiresAt),
          gt(partnerApiKeys.expiresAt, new Date()),
        ),
      ),
    );

  // Validate the key hash
  const validKey = apiKeys.find((key) =>
    validateApiKeyHash(providedKey, key.keyHash),
  );

  if (!validKey) {
    return {
      success: false,
      error: NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 }),
    };
  }

  // Update last used timestamp (fire and forget)
  db.update(partnerApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(partnerApiKeys.id, validKey.id))
    .then()
    .catch((err) => console.error('Failed to update lastUsedAt:', err));

  return {
    success: true,
    data: {
      apiKeyId: validKey.id,
      partnerId: validKey.partnerId,
      permissions: validKey.permissions ?? [],
    },
  };
};

export default validateApiKey;
