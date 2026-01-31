import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientContacts, privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

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

  const [updated] = await db
    .update(privateClientContacts)
    .set(updateData)
    .where(and(eq(privateClientContacts.id, id), eq(privateClientContacts.partnerId, partnerId)))
    .returning();

  // Cascade contact updates to linked orders
  // This ensures distributor portal shows current client details
  if (data.name !== undefined || data.phone !== undefined || data.email !== undefined) {
    const orderUpdateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) orderUpdateData.clientName = data.name;
    if (data.phone !== undefined) orderUpdateData.clientPhone = data.phone || null;
    if (data.email !== undefined) orderUpdateData.clientEmail = data.email || null;

    await db
      .update(privateClientOrders)
      .set(orderUpdateData)
      .where(eq(privateClientOrders.clientId, id));
  }

  return updated;
});

export default update;
