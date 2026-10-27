import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientContacts, privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import buildOrderClientPatch, {
  PRE_APPROVAL_ORDER_STATUSES,
} from '../utils/clientDetailCascade';
import { changesClientIdentity } from '../utils/clientIdentity';

const updateSchema = z.object({
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
 * Update a client contact
 */
const update = winePartnerProcedure.input(updateSchema).mutation(async ({ input, ctx }) => {
  const { id, ...data } = input;
  const { partnerId } = ctx;

  // Verify ownership
  const existing = await db.query.privateClientContacts.findFirst({
    where: { id, partnerId },
  });

  if (!existing) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Client contact not found',
    });
  }

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.phone !== undefined) updateData.phone = data.phone || null;
  if (data.addressLine1 !== undefined) updateData.addressLine1 = data.addressLine1 || null;
  if (data.addressLine2 !== undefined) updateData.addressLine2 = data.addressLine2 || null;
  if (data.city !== undefined) updateData.city = data.city || null;
  if (data.stateProvince !== undefined) updateData.stateProvince = data.stateProvince || null;
  if (data.postalCode !== undefined) updateData.postalCode = data.postalCode || null;
  if (data.country !== undefined) updateData.country = data.country || null;
  if (data.winePreferences !== undefined) updateData.winePreferences = data.winePreferences || null;
  if (data.deliveryInstructions !== undefined)
    updateData.deliveryInstructions = data.deliveryInstructions || null;
  if (data.paymentNotes !== undefined) updateData.paymentNotes = data.paymentNotes || null;
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  /*
    The distributor verified this person. A new name, phone or email is
    someone it has not verified, so the verification goes with the change and
    the next order waits for it again.
  */
  if (existing.cityDrinksVerifiedAt && changesClientIdentity(existing, data)) {
    updateData.cityDrinksVerifiedAt = null;
    updateData.cityDrinksVerifiedBy = null;
  }

  const [updated] = await db
    .update(privateClientContacts)
    .set(updateData)
    .where(and(eq(privateClientContacts.id, id), eq(privateClientContacts.partnerId, partnerId)))
    .returning();

  /*
    Bring the order's own copy of the client details with it, on this
    partner's orders that C&C has not yet approved. Approved orders are past
    the point a partner can change who they are for: C&C corrects those.

    Both this and `adminUpdate` decide what cascades in one place. They drifted
    before: this path omitted the address entirely, and rewrote EVERY order
    including delivered ones — restating the client details on a delivery note
    that had already gone out.
  */
  const orderPatch = buildOrderClientPatch(data);

  if (Object.keys(orderPatch).length > 0) {
    await db
      .update(privateClientOrders)
      .set({ ...orderPatch, updatedAt: new Date() })
      .where(
        and(
          eq(privateClientOrders.clientId, id),
          // This partner's own orders, and only those C&C has not approved yet
          eq(privateClientOrders.partnerId, partnerId),
          inArray(privateClientOrders.status, PRE_APPROVAL_ORDER_STATUSES),
        ),
      );
  }

  return updated;
});

export default update;
