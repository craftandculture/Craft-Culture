import { eq, or, sql } from 'drizzle-orm';

import ensureClientCode from '@/app/_cellar/data/ensureClientCode';
import getClientCodes from '@/app/_cellar/data/getClientCodes';
import db from '@/database/client';
import { partners } from '@/database/schema';

/**
 * Stock owners whose names must not appear on a physical label
 *
 * Every private collector, plus any other partner who asked for discreet
 * labels (`metadata.hideNameOnLabels`). Each comes back with their reference,
 * issuing one when a hidden owner has none yet, so a label never has to fall
 * back further than the code.
 *
 * Throws when the partners cannot be read: callers must treat that as "hide
 * everything", never as "hide nothing".
 *
 * @returns The hidden owners with their reference (null if one could not be
 *   issued)
 */
const getHiddenLabelOwners = async () => {
  const rows = await db
    .select({
      partnerId: partners.id,
      name: partners.businessName,
      type: partners.type,
    })
    .from(partners)
    .where(
      or(
        eq(partners.type, 'private_collector'),
        sql`(${partners.metadata} ->> 'hideNameOnLabels') = 'true'`,
      ),
    );

  const codes = await getClientCodes(rows.map((row) => row.partnerId));

  const missing = rows.filter((row) => !codes.has(row.partnerId));
  const issued = await Promise.all(
    missing.map(async (row) => [row.partnerId, await ensureClientCode(row.partnerId)] as const),
  );
  for (const [partnerId, code] of issued) {
    if (code) codes.set(partnerId, code);
  }

  return rows.map((row) => ({
    partnerId: row.partnerId,
    name: row.name,
    isPrivateCollector: row.type === 'private_collector',
    code: codes.get(row.partnerId) ?? null,
  }));
};

export type HiddenLabelOwner = Awaited<
  ReturnType<typeof getHiddenLabelOwners>
>[number];

export default getHiddenLabelOwners;
