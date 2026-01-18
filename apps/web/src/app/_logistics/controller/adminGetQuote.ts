import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsQuoteLineItems,
  logisticsQuotes,
  logisticsShipments,
  users,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get a single freight quote with all details
 *
 * Returns the quote with line items, linked shipment info, and user details.
 */
const adminGetQuote = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input }) => {
    const { id } = input;

    // Get quote with related data
    const [result] = await db
      .select({
        quote: logisticsQuotes,
        shipment: {
          id: logisticsShipments.id,
          shipmentNumber: logisticsShipments.shipmentNumber,
          type: logisticsShipments.type,
          transportMode: logisticsShipments.transportMode,
          status: logisticsShipments.status,
          originCountry: logisticsShipments.originCountry,
          originCity: logisticsShipments.originCity,
          destinationCountry: logisticsShipments.destinationCountry,
          destinationCity: logisticsShipments.destinationCity,
        },
        createdByUser: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(logisticsQuotes)
      .leftJoin(logisticsShipments, eq(logisticsQuotes.shipmentId, logisticsShipments.id))
      .leftJoin(users, eq(logisticsQuotes.createdBy, users.id))
      .where(eq(logisticsQuotes.id, id))
      .limit(1);

    if (!result) {
      return null;
    }

    // Get line items
    const lineItems = await db
      .select()
      .from(logisticsQuoteLineItems)
      .where(eq(logisticsQuoteLineItems.quoteId, id))
      .orderBy(logisticsQuoteLineItems.sortOrder);

    // Get accepted/rejected by user info if applicable
    let acceptedByUser = null;
    let rejectedByUser = null;

    if (result.quote.acceptedBy) {
      const [user] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, result.quote.acceptedBy))
        .limit(1);
      acceptedByUser = user || null;
    }

    if (result.quote.rejectedBy) {
      const [user] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, result.quote.rejectedBy))
        .limit(1);
      rejectedByUser = user || null;
    }

    return {
      ...result.quote,
      shipment: result.shipment?.id ? result.shipment : null,
      createdByUser: result.createdByUser?.id ? result.createdByUser : null,
      acceptedByUser,
      rejectedByUser,
      lineItems,
    };
  });

export default adminGetQuote;
