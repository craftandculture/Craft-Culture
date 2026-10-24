import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsDocuments,
  logisticsShipmentActivityLogs,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import partnerDocumentTypes from '../constants/partnerDocumentTypes';
import isPartnerShipmentItem from '../utils/isPartnerShipmentItem';
import toPartnerShipment from '../utils/toPartnerShipment';
import toPartnerShipmentDocument from '../utils/toPartnerShipmentDocument';
import toPartnerShipmentItem from '../utils/toPartnerShipmentItem';

/**
 * One shipment, as the current partner may see it
 *
 * Only the partner's own lines. Documents describe the whole consignment, so
 * on a shipment shared with other owners the partner sees only documents they
 * uploaded themselves; on a shipment wholly theirs, the shipping documents but
 * never our freight or agent invoices. Of the activity log, only status changes
 * and the partner's own entries are shown.
 */
const partnerGetOne = winePartnerProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx: { partner, user } }) => {
    const [shipment] = await db.select().from(logisticsShipments).where(eq(logisticsShipments.id, input.id));

    const allItems = shipment
      ? await db
          .select()
          .from(logisticsShipmentItems)
          .where(eq(logisticsShipmentItems.shipmentId, input.id))
          .orderBy(logisticsShipmentItems.sortOrder)
      : [];
    const items = allItems.filter((item) => isPartnerShipmentItem(item, shipment?.partnerId ?? null, partner.id));

    // Same answer whether the shipment is missing or simply not theirs
    if (!shipment || (shipment.partnerId !== partner.id && items.length === 0)) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Shipment not found' });
    }

    const whollyTheirs = shipment.partnerId === partner.id && items.length === allItems.length;

    const [documents, activityLogs] = await Promise.all([
      db
        .select()
        .from(logisticsDocuments)
        .where(eq(logisticsDocuments.shipmentId, input.id))
        .orderBy(logisticsDocuments.uploadedAt),
      db
        .select()
        .from(logisticsShipmentActivityLogs)
        .where(eq(logisticsShipmentActivityLogs.shipmentId, input.id))
        .orderBy(desc(logisticsShipmentActivityLogs.createdAt))
        .limit(50),
    ]);

    return {
      ...toPartnerShipment(shipment, items),
      items: items.map(toPartnerShipmentItem),
      documents: documents
        .filter((doc) =>
          whollyTheirs ? partnerDocumentTypes.has(doc.documentType) : doc.uploadedBy === user.id,
        )
        .map(toPartnerShipmentDocument),
      activityLogs: activityLogs
        .filter((log) => log.newStatus !== null || log.partnerId === partner.id)
        .slice(0, 20)
        .map((log) => ({
          id: log.id,
          action: log.action,
          previousStatus: log.previousStatus,
          newStatus: log.newStatus,
          notes: log.partnerId === partner.id ? log.notes : null,
          createdAt: log.createdAt,
        })),
    };
  });

export default partnerGetOne;
