import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsDocuments,
  logisticsShipmentActivityLogs,
  logisticsShipmentItems,
  logisticsShipments,
  partners,
  privateClientContacts,
  users,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get a single shipment with all related data
 *
 * @example
 *   await trpcClient.logistics.admin.getOne.query({ id: "uuid" });
 */
const adminGetOne = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input }) => {
    // Get the shipment with partner and client
    const [result] = await db
      .select({
        shipment: logisticsShipments,
        partner: partners,
        clientContact: privateClientContacts,
        createdByUser: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(logisticsShipments)
      .leftJoin(partners, eq(logisticsShipments.partnerId, partners.id))
      .leftJoin(
        privateClientContacts,
        eq(logisticsShipments.clientContactId, privateClientContacts.id),
      )
      .leftJoin(users, eq(logisticsShipments.createdBy, users.id))
      .where(eq(logisticsShipments.id, input.id));

    if (!result) {
      return null;
    }

    // Run all secondary queries in parallel for better performance
    const [items, documents, activityLogs] = await Promise.all([
      // Get items
      db
        .select()
        .from(logisticsShipmentItems)
        .where(eq(logisticsShipmentItems.shipmentId, input.id))
        .orderBy(logisticsShipmentItems.sortOrder),

      // Get documents
      db
        .select({
          document: logisticsDocuments,
          uploadedByUser: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(logisticsDocuments)
        .leftJoin(users, eq(logisticsDocuments.uploadedBy, users.id))
        .where(eq(logisticsDocuments.shipmentId, input.id))
        .orderBy(logisticsDocuments.uploadedAt),

      // Get activity logs
      db
        .select({
          log: logisticsShipmentActivityLogs,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(logisticsShipmentActivityLogs)
        .leftJoin(users, eq(logisticsShipmentActivityLogs.userId, users.id))
        .where(eq(logisticsShipmentActivityLogs.shipmentId, input.id))
        .orderBy(logisticsShipmentActivityLogs.createdAt),
    ]);

    return {
      ...result.shipment,
      partner: result.partner,
      clientContact: result.clientContact,
      createdByUser: result.createdByUser,
      items,
      documents: documents.map((d) => ({
        ...d.document,
        uploadedByUser: d.uploadedByUser,
      })),
      activityLogs: activityLogs.map((l) => ({
        ...l.log,
        user: l.user,
      })),
    };
  });

export default adminGetOne;
