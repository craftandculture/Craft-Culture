import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientContacts, privateClientOrders } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import buildOrderClientPatch, {
  OPEN_ORDER_STATUSES,
} from '../utils/clientDetailCascade';

const adminUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  winePreferences: z.string().optional(),
  deliveryInstructions: z.string().optional(),
  paymentNotes: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Correct a client's details from the admin side, after their order is placed.
 *
 * The partner-facing `update` is scoped to the caller's own partner, which is
 * how it should be — but it means an admin, who belongs to no wine partner,
 * could not fix a client's phone number at all. Every correction had to go back
 * to the partner who created the record, and in the meantime the distributor
 * was delivering against the wrong number.
 *
 * The client record is the source of truth; the order's copy of the details is
 * brought with it for orders still in flight. Delivered and cancelled orders
 * keep what was true at the time — see `clientDetailCascade`.
 *
 * @param input - The client and the fields being corrected
 * @returns The updated client and how many orders were brought with it
 */
const adminUpdate = wmsOperatorProcedure
  .input(adminUpdateSchema)
  .mutation(async ({ input }) => {
    const { id, ...data } = input;

    const existing = await db.query.privateClientContacts.findFirst({
      where: { id },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Client contact not found',
      });
    }

    // Only what was supplied: `undefined` means "not edited", and an empty
    // string is a deliberate clearing.
    const contactPatch: Record<string, unknown> = { updatedAt: new Date() };
    const assign = (key: keyof typeof data) => {
      const value = data[key];
      if (value === undefined) return;
      contactPatch[key] = key === 'name' ? value : value || null;
    };

    (
      [
        'name',
        'email',
        'phone',
        'addressLine1',
        'addressLine2',
        'city',
        'stateProvince',
        'postalCode',
        'country',
        'winePreferences',
        'deliveryInstructions',
        'paymentNotes',
        'notes',
      ] as (keyof typeof data)[]
    ).forEach(assign);

    const [updated] = await db
      .update(privateClientContacts)
      .set(contactPatch)
      .where(eq(privateClientContacts.id, id))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Client was not updated',
      });
    }

    const orderPatch = buildOrderClientPatch(data);
    let ordersUpdated: { id: string }[] = [];

    if (Object.keys(orderPatch).length > 0) {
      ordersUpdated = await db
        .update(privateClientOrders)
        .set({ ...orderPatch, updatedAt: new Date() })
        .where(
          and(
            eq(privateClientOrders.clientId, id),
            inArray(privateClientOrders.status, OPEN_ORDER_STATUSES),
          ),
        )
        .returning({ id: privateClientOrders.id });
    }

    return { contact: updated, ordersUpdated: ordersUpdated.length };
  });

export default adminUpdate;
