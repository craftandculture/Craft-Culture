import { z } from 'zod';

import db from '@/database/client';
import { privateClientContacts } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
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
 * Create a new client contact for the wine partner
 */
const create = winePartnerProcedure.input(createSchema).mutation(async ({ input, ctx }) => {
  const { partnerId } = ctx;

  const [contact] = await db
    .insert(privateClientContacts)
    .values({
      partnerId,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      addressLine1: input.addressLine1 || null,
      addressLine2: input.addressLine2 || null,
      city: input.city || null,
      stateProvince: input.stateProvince || null,
      postalCode: input.postalCode || null,
      country: input.country || null,
      winePreferences: input.winePreferences || null,
      deliveryInstructions: input.deliveryInstructions || null,
      paymentNotes: input.paymentNotes || null,
      notes: input.notes || null,
    })
    .returning();

  return contact;
});

export default create;
