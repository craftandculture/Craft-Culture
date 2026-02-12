import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { partners, wmsPallets } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { createPalletSchema } from '../schemas/palletSchema';

/**
 * Generate a unique pallet code in format PALLET-YYYY-NNNN
 */
const generatePalletCode = async () => {
  const year = new Date().getFullYear();
  const prefix = `PALLET-${year}-`;

  // Get the highest sequence number for this year
  const result = await db.execute<{ max_seq: string | null }>(sql`
    SELECT MAX(SUBSTRING(pallet_code FROM 13)::integer) as max_seq
    FROM wms_pallets
    WHERE pallet_code LIKE ${prefix + '%'}
  `);

  // Handle both array and { rows: [] } return formats from db.execute
  const rows = Array.isArray(result) ? result : result.rows ?? [];
  const maxSeq = rows[0]?.max_seq ? parseInt(rows[0].max_seq, 10) : 0;
  const nextSeq = (maxSeq + 1).toString().padStart(4, '0');

  return `${prefix}${nextSeq}`;
};

/**
 * Create a new pallet for building mixed stock
 *
 * @example
 *   await trpcClient.wms.admin.pallets.create.mutate({
 *     ownerId: "partner-uuid",
 *     storageType: "customer_storage",
 *     notes: "Mixed pallet for storage"
 *   });
 */
const adminCreatePallet = adminProcedure
  .input(createPalletSchema)
  .mutation(async ({ input }) => {
    const { ownerId, storageType, notes } = input;

    // Get owner info
    const [owner] = await db
      .select({
        id: partners.id,
        name: partners.businessName,
      })
      .from(partners)
      .where(eq(partners.id, ownerId));

    if (!owner) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Owner not found',
      });
    }

    // Generate pallet code and barcode
    const palletCode = await generatePalletCode();
    const barcode = palletCode; // Use same code for barcode

    // Create pallet
    const [pallet] = await db
      .insert(wmsPallets)
      .values({
        palletCode,
        barcode,
        ownerId,
        ownerName: owner.name,
        totalCases: 0,
        storageType: storageType || 'customer_storage',
        status: 'active',
        isSealed: false,
        notes,
      })
      .returning();

    return {
      success: true,
      pallet,
      message: `Pallet ${palletCode} created`,
    };
  });

export default adminCreatePallet;
