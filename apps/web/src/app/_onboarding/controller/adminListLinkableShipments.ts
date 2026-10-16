import { and, desc, eq, notInArray } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipments, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Inbound shipments a transfer can be linked to — every one not yet received
 * or cancelled, newest first
 */
const adminListLinkableShipments = adminProcedure.query(async () =>
  db
    .select({
      id: logisticsShipments.id,
      shipmentNumber: logisticsShipments.shipmentNumber,
      name: logisticsShipments.name,
      status: logisticsShipments.status,
      eta: logisticsShipments.eta,
      totalCases: logisticsShipments.totalCases,
      partnerName: partners.businessName,
    })
    .from(logisticsShipments)
    .leftJoin(partners, eq(partners.id, logisticsShipments.partnerId))
    .where(
      and(eq(logisticsShipments.type, 'inbound'), notInArray(logisticsShipments.status, ['delivered', 'cancelled'])),
    )
    .orderBy(desc(logisticsShipments.createdAt))
    .limit(150),
);

export default adminListLinkableShipments;
