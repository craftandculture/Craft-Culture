import { and, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsGroupCostLines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { setGroupInvoiceVendorSchema } from '../schemas/shipmentGroupSchemas';

/**
 * Set the supplier/vendor on every cost line belonging to one invoice within a
 * group. Lines are grouped by `invoiceRef ?? sourceDocument ?? 'Manual entry'`,
 * so this updates all lines that share the given docKey.
 */
const adminSetGroupInvoiceVendor = adminProcedure
  .input(setGroupInvoiceVendorSchema)
  .mutation(async ({ input }) => {
    const { groupId, docKey, vendor } = input;
    const clean = vendor && vendor.trim() ? vendor.trim() : null;

    await db
      .update(logisticsGroupCostLines)
      .set({ vendor: clean })
      .where(
        and(
          eq(logisticsGroupCostLines.groupId, groupId),
          sql`COALESCE(${logisticsGroupCostLines.invoiceRef}, ${logisticsGroupCostLines.sourceDocument}, 'Manual entry') = ${docKey}`,
        ),
      );

    return { vendor: clean };
  });

export default adminSetGroupInvoiceVendor;
