import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import createPartnerSchema from '../schemas/createPartnerSchema';
import normalisePartnerName from '../utils/normalisePartnerName';

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

    /*
      One business, one record.

      Nothing checked this, and a partner already on file could be created a
      second time by anyone arriving through a different route — which is
      exactly what happened to Craft & Culture, ending up with the landed stock
      under one record and the in-transit stock under another. Owner pricing
      margins are keyed on the record, so the second one prices at whatever the
      defaults are while the screen shows the rate as set.

      Refused rather than merged, because guessing that two names mean one
      business is the caller's judgement to make, not this endpoint's.
    */
    if (!input.allowDuplicateName) {
      const key = normalisePartnerName(businessName);

      if (key) {
        const existing = await db
          .select({ id: partners.id, businessName: partners.businessName })
          .from(partners);

        const clash = existing.find(
          (partner) => normalisePartnerName(partner.businessName) === key,
        );

        if (clash) {
          throw new TRPCError({
            code: 'CONFLICT',
            message:
              `"${clash.businessName}" is already on file. Use that record rather than ` +
              'creating a second — stock and pricing margins are held against the record, ' +
              'so a duplicate splits both. Tick "same name, different business" if these ' +
              'really are two entities.',
          });
        }
      }
    }

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
