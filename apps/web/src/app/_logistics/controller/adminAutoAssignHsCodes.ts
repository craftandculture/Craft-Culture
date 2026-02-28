import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const SPARKLING_TERMS = [
  'champagne', 'sparkling', 'cava', 'prosecco', 'cremant', 'sekt', 'spumante', 'franciacorta',
];

/**
 * Auto-detect HS code from product name and region.
 * LWIN-mapped items are always wine; sparkling detection via keyword matching.
 */
const detectHsCode = (productName: string, region: string | null, lwin: string | null) => {
  const text = `${productName} ${region ?? ''}`.toLowerCase();
  if (SPARKLING_TERMS.some((t) => text.includes(t))) return '22041000';
  if (lwin) return '22042100';
  return null;
};

/**
 * Auto-assign HS codes to shipment items that don't have one.
 * Detects sparkling (22041000) vs still wine (22042100) from product/region text.
 * Only assigns to LWIN-mapped items; non-LWIN items are skipped.
 */
const adminAutoAssignHsCodes = adminProcedure
  .input(z.object({ shipmentId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const items = await db
      .select()
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, input.shipmentId));

    let updated = 0;
    let skipped = 0;

    for (const item of items) {
      if (item.hsCode) { skipped++; continue; }
      const hsCode = detectHsCode(item.productName, item.region, item.lwin);
      if (!hsCode) { skipped++; continue; }

      await db
        .update(logisticsShipmentItems)
        .set({ hsCode, updatedAt: new Date() })
        .where(eq(logisticsShipmentItems.id, item.id));
      updated++;
    }

    return { updated, skipped };
  });

export default adminAutoAssignHsCodes;
