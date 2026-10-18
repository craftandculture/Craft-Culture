import { desc, eq, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  cellarMemberships,
  cellarUkHoldings,
  cellarUkRotations,
  partners,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import getClientCodes from '../data/getClientCodes';

/**
 * C&C's LCB Burton account as last imported, and who each rotation is for
 *
 * Unassigned rotations are the work: they are wine in our account that no
 * member can see yet. The owners offered are the private cellar members —
 * collectors, and anyone holding a membership, which includes members filed
 * before the collector type existed.
 *
 * Never throws for a missing table: before the migration has run the screen
 * says there is nothing imported rather than failing.
 */
const adminGetUkStock = staffAdminProcedure.query(async () => {
  try {
    const [rows, owners] = await Promise.all([
      db
        .select({
          id: cellarUkHoldings.id,
          rotation: cellarUkHoldings.rotation,
          lwin18: cellarUkHoldings.lwin18,
          brand: cellarUkHoldings.brand,
          description: cellarUkHoldings.description,
          vintage: cellarUkHoldings.vintage,
          bottlesPerCase: cellarUkHoldings.bottlesPerCase,
          bottleSizeLitres: cellarUkHoldings.bottleSizeLitres,
          cases: cellarUkHoldings.cases,
          singles: cellarUkHoldings.singles,
          totalBottles: cellarUkHoldings.totalBottles,
          packaging: cellarUkHoldings.packaging,
          receivedAt: cellarUkHoldings.receivedAt,
          importedAt: cellarUkHoldings.createdAt,
          partnerId: cellarUkRotations.partnerId,
          isHouse: cellarUkRotations.isHouse,
          ownerName: partners.businessName,
        })
        .from(cellarUkHoldings)
        .leftJoin(cellarUkRotations, eq(cellarUkHoldings.rotation, cellarUkRotations.rotation))
        .leftJoin(partners, eq(cellarUkRotations.partnerId, partners.id))
        .orderBy(desc(cellarUkHoldings.receivedAt), cellarUkHoldings.rotation),
      db
        .selectDistinct({ id: partners.id, name: partners.businessName })
        .from(partners)
        .leftJoin(cellarMemberships, eq(cellarMemberships.partnerId, partners.id))
        .where(
          or(
            eq(partners.type, 'private_collector'),
            sql`${cellarMemberships.id} IS NOT NULL`,
          ),
        )
        .orderBy(partners.businessName),
    ]);

    const importedAt = rows.reduce<Date | null>(
      (latest, row) => (!latest || row.importedAt > latest ? row.importedAt : latest),
      null,
    );

    const codes = await getClientCodes(owners.map((owner) => owner.id));

    return {
      rows,
      owners: owners
        .filter((owner) => owner.name)
        .map((owner) => ({ ...owner, code: codes.get(owner.id) ?? null })),
      importedAt,
      ownerIds: [...new Set(rows.map((row) => row.partnerId).filter(Boolean))] as string[],
    };
  } catch (error) {
    logger.error('Could not read UK holdings', { error });
    return { rows: [], owners: [], importedAt: null, ownerIds: [] as string[] };
  }
});

export default adminGetUkStock;
