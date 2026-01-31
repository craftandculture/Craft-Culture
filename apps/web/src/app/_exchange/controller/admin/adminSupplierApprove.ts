import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  partnerId: z.string().uuid(),
  action: z.enum(['approve', 'suspend', 'reactivate']),
  notes: z.string().optional(),
});

/**
 * Approve, suspend, or reactivate a supplier
 *
 * Admin action to change supplier status.
 * - approve: pending -> active
 * - suspend: active -> suspended
 * - reactivate: suspended -> active
 *
 * @example
 *   await api.exchange.admin.supplierApprove.mutate({
 *     partnerId: 'uuid',
 *     action: 'approve',
 *   });
 */
const adminSupplierApprove = adminProcedure
  .input(inputSchema)
  .mutation(async ({ input }) => {
    const { partnerId, action, notes } = input;

    // Get current supplier
    const [supplier] = await db
      .select()
      .from(partners)
      .where(and(eq(partners.id, partnerId), eq(partners.type, 'supplier')));

    if (!supplier) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Supplier not found',
      });
    }

    // Determine new status based on action
    let newStatus: 'pending' | 'active' | 'suspended';

    switch (action) {
      case 'approve':
        if (supplier.status !== 'pending') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Can only approve suppliers with pending status',
          });
        }
        newStatus = 'active';
        break;

      case 'suspend':
        if (supplier.status !== 'active') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Can only suspend active suppliers',
          });
        }
        newStatus = 'suspended';
        break;

      case 'reactivate':
        if (supplier.status !== 'suspended') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Can only reactivate suspended suppliers',
          });
        }
        newStatus = 'active';
        break;

      default:
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid action',
        });
    }

    // Update supplier status
    const [updated] = await db
      .update(partners)
      .set({
        status: newStatus,
        notes: notes ?? supplier.notes,
        updatedAt: new Date(),
      })
      .where(eq(partners.id, partnerId))
      .returning();

    return {
      supplier: updated,
      previousStatus: supplier.status,
      newStatus,
      action,
    };
  });

export default adminSupplierApprove;
