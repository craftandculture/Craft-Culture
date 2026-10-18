import { TRPCError } from '@trpc/server';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarDeliveryAddresses, partners } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

/** Most a member is likely to need; stops a runaway list, not a real one */
const MAX_ADDRESSES = 12;

/**
 * Add or change one of the member's saved delivery addresses
 *
 * The default is mirrored onto the member's partner record, which older
 * screens and the delivery order still read. Making an address the default
 * clears the flag on every other, in one transaction, so a member never has
 * two or none.
 *
 * Ownership comes from the session: an id belonging to another member matches
 * nothing and is refused.
 */
const memberSaveAddress = stockOwnerProcedure
  .input(
    z.object({
      id: z.string().uuid().optional(),
      label: z.string().trim().min(1, 'Give the address a name').max(60),
      address: z.string().trim().min(5, 'Enter the full address').max(500),
      instructions: z.string().trim().max(500).nullable().optional(),
      makeDefault: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const partnerId = ctx.partner.id;
    const instructions = input.instructions?.trim() || null;

    const saved = await db.transaction(async (tx) => {
      const existing = await tx
        .select({
          id: cellarDeliveryAddresses.id,
          isDefault: cellarDeliveryAddresses.isDefault,
        })
        .from(cellarDeliveryAddresses)
        .where(eq(cellarDeliveryAddresses.partnerId, partnerId));

      const current = input.id
        ? existing.find((row) => row.id === input.id)
        : undefined;

      if (input.id && !current) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'That address is not one of yours.',
        });
      }

      if (!input.id && existing.length >= MAX_ADDRESSES) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `You can keep up to ${MAX_ADDRESSES} addresses. Remove one you no longer use first.`,
        });
      }

      /* The first address a member saves is their default whatever they ticked */
      const isDefault =
        input.makeDefault === true ||
        current?.isDefault === true ||
        existing.length === 0;

      const now = new Date();

      const [row] = current
        ? await tx
            .update(cellarDeliveryAddresses)
            .set({
              label: input.label,
              address: input.address,
              instructions,
              isDefault,
              updatedAt: now,
            })
            .where(
              and(
                eq(cellarDeliveryAddresses.id, current.id),
                eq(cellarDeliveryAddresses.partnerId, partnerId),
              ),
            )
            .returning({ id: cellarDeliveryAddresses.id })
        : await tx
            .insert(cellarDeliveryAddresses)
            .values({
              partnerId,
              label: input.label,
              address: input.address,
              instructions,
              isDefault,
            })
            .returning({ id: cellarDeliveryAddresses.id });

      if (!row) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not save that address',
        });
      }

      if (isDefault) {
        await tx
          .update(cellarDeliveryAddresses)
          .set({ isDefault: false, updatedAt: now })
          .where(
            and(
              eq(cellarDeliveryAddresses.partnerId, partnerId),
              ne(cellarDeliveryAddresses.id, row.id),
            ),
          );

        await tx
          .update(partners)
          .set({
            deliveryAddress: input.address,
            deliveryInstructions: instructions,
            updatedAt: now,
          })
          .where(eq(partners.id, partnerId));
      }

      return { id: row.id, isDefault };
    });

    return saved;
  });

export default memberSaveAddress;
