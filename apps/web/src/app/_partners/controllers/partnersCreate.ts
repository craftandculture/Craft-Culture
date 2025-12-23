import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import createPartnerSchema from '../schemas/createPartnerSchema';

/**
 * Create a new licensed partner entity
 *
 * Partners are external business entities (retailers, distributors) that
 * fulfill B2C orders. They receive payment from customers and purchase
 * inventory from C&C.
 */
const partnersCreate = adminProcedure
  .input(createPartnerSchema)
  .mutation(async ({ input }) => {
    const {
      type,
      businessName,
      businessAddress,
      businessPhone,
      businessEmail,
      taxId,
      logoUrl,
      paymentDetails,
      commissionRate,
      notes,
    } = input;

    // Create partner entity
    const [partner] = await db
      .insert(partners)
      .values({
        type,
        businessName,
        businessAddress: businessAddress ?? null,
        businessPhone: businessPhone ?? null,
        businessEmail: businessEmail || null,
        taxId: taxId ?? null,
        logoUrl: logoUrl || null,
        paymentDetails: paymentDetails ?? null,
        commissionRate,
        notes: notes ?? null,
      })
      .returning();

    return partner;
  });

export default partnersCreate;
