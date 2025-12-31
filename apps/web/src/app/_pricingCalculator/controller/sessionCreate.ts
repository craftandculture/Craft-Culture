import db from '@/database/client';
import { pricingSessions } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import createSessionSchema from '../schemas/createSessionSchema';

/**
 * Create a new pricing session
 *
 * @example
 *   await trpcClient.pricingCalc.session.create.mutate({
 *     name: 'Supplier ABC - January 2025',
 *     sourceType: 'upload',
 *     sourceFileName: 'supplier-prices.xlsx',
 *     rawData: [...parsedRows],
 *     detectedColumns: ['Wine', 'Price', 'Vintage'],
 *   });
 */
const sessionCreate = adminProcedure
  .input(createSessionSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const [session] = await db
      .insert(pricingSessions)
      .values({
        name: input.name,
        sourceType: input.sourceType,
        sourceFileName: input.sourceFileName,
        googleSheetId: input.googleSheetId,
        rawData: input.rawData,
        detectedColumns: input.detectedColumns,
        createdBy: user.id,
      })
      .returning();

    return session;
  });

export default sessionCreate;
