import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { sourceCustomerPos } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import createCustomerPoSchema from '../schemas/createCustomerPoSchema';
import generateCpoNumber from '../utils/generateCpoNumber';

/**
 * Create a new Customer PO
 *
 * @example
 *   await trpcClient.source.admin.customerPo.create.mutate({
 *     poNumber: "PO-2026-001",
 *     customerName: "John Smith",
 *     customerCompany: "Wine Imports Ltd",
 *   });
 */
const adminCreateCustomerPo = adminProcedure
  .input(createCustomerPoSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    try {
      const ccPoNumber = await generateCpoNumber();

      const [customerPo] = await db
        .insert(sourceCustomerPos)
        .values({
          poNumber: input.poNumber,
          ccPoNumber,
          rfqId: input.rfqId || null,
          customerName: input.customerName,
          customerCompany: input.customerCompany || null,
          customerEmail: input.customerEmail || null,
          notes: input.notes || null,
          status: 'draft',
          createdBy: user.id,
        })
        .returning();

      if (!customerPo) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create Customer PO',
        });
      }

      return customerPo;
    } catch (error) {
      logger.error('Error creating Customer PO:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create Customer PO. Please try again.',
      });
    }
  });

export default adminCreateCustomerPo;
