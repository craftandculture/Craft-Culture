import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import createRfqSchema from '../schemas/createRfqSchema';
import generateRfqNumber from '../utils/generateRfqNumber';

/**
 * Create a new SOURCE RFQ
 *
 * @example
 *   await trpcClient.source.admin.create.mutate({
 *     name: "Client Wine List - January 2026",
 *     sourceType: "excel",
 *     sourceFileName: "wine_list.xlsx"
 *   });
 */
const adminCreateRfq = adminProcedure
  .input(createRfqSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    try {
      const rfqNumber = await generateRfqNumber();

      const [rfq] = await db
        .insert(sourceRfqs)
        .values({
          rfqNumber,
          name: input.name,
          description: input.description,
          sourceType: input.sourceType,
          sourceFileName: input.sourceFileName,
          rawInputText: input.rawInputText,
          distributorName: input.distributorName,
          distributorEmail: input.distributorEmail || null,
          distributorCompany: input.distributorCompany,
          distributorNotes: input.distributorNotes,
          responseDeadline: input.responseDeadline,
          createdBy: user.id,
          status: 'draft',
        })
        .returning();

      if (!rfq) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create RFQ',
        });
      }

      return rfq;
    } catch (error) {
      console.error('Error creating RFQ:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create RFQ',
        cause: error,
      });
    }
  });

export default adminCreateRfq;
