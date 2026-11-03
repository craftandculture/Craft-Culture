import { and, asc, eq, isNotNull, isNull, or } from 'drizzle-orm';
import type { TransactionalVariables } from 'loops';

import createNotification from '@/app/_notifications/utils/createNotification';
import { ORDER_EMAIL_TEMPLATE_ID } from '@/app/_privateClientOrders/constants';
import { ORDER_EMAIL_SHADOW_INBOX } from '@/app/_privateClientOrders/data/getOrderEmailMode';
import getPartnerUsers from '@/app/_privateClientOrders/data/getPartnerUsers';
import isCraftCulturePartner from '@/app/_privateClientOrders/utils/isCraftCulturePartner';
import db from '@/database/client';
import {
  logisticsShipmentActivityLogs,
  logisticsShipmentItems,
  logisticsShipments,
  partners,
  wmsStockMovements,
} from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import getShipmentEmailMode from './getShipmentEmailMode';
import buildShipmentPartnerEmail, {
  SHIPMENT_MILESTONES,
  type ShipmentMilestone,
} from '../utils/buildShipmentPartnerEmail';

/** The activity log line that records a partner was told, and stops a repeat */
const NOTIFIED = 'partner_notified';

const LABELS: Record<ShipmentMilestone, string> = {
  departed: 'departed for the UAE',
  arrived: 'arrived in the UAE',
  received: 'in stock',
};

/**
 * Tell a wine partner their inbound shipment has departed, arrived, or is in
 * stock: one email and one notice each, the way the switch says
 *
 * Each moment is told once, and never after a later one: a shipment moved
 * straight from Collected to At port is told it has arrived, not that it
 * departed days ago. The email goes to the partner's business address (or,
 * with none, one person on the account), never to every login. Shadow sends
 * Kevin one copy and no notices; live sends the email and a notice to each
 * person on the account. Collectors, C&C's own stock and outbound shipments
 * are not told here.
 *
 * Never throws: a status change or receiving must not fail over an email.
 *
 * @param shipmentId - The shipment
 * @param milestone - The moment it has reached
 */
const notifyPartnerOfShipment = async (shipmentId: string, milestone: ShipmentMilestone) => {
  try {
    const mode = await getShipmentEmailMode();
    if (mode === 'off') return;

    const [shipment] = await db.select().from(logisticsShipments).where(eq(logisticsShipments.id, shipmentId)).limit(1);
    if (!shipment || shipment.type !== 'inbound' || !shipment.partnerId) return;

    const [partner] = await db
      .select({ id: partners.id, name: partners.businessName, email: partners.businessEmail, type: partners.type })
      .from(partners)
      .where(eq(partners.id, shipment.partnerId))
      .limit(1);
    if (!partner || partner.type !== 'wine_partner' || (await isCraftCulturePartner(partner.id))) return;

    const told = await db
      .select({ metadata: logisticsShipmentActivityLogs.metadata })
      .from(logisticsShipmentActivityLogs)
      .where(and(eq(logisticsShipmentActivityLogs.shipmentId, shipmentId), eq(logisticsShipmentActivityLogs.action, NOTIFIED)));
    const furthest = Math.max(
      -1,
      ...told.map((row) => SHIPMENT_MILESTONES.indexOf((row.metadata as { milestone?: ShipmentMilestone } | null)?.milestone ?? 'departed')),
    );
    if (SHIPMENT_MILESTONES.indexOf(milestone) <= furthest) return;

    const [items, changes, receipts] = await Promise.all([
      db
        .select({
          name: logisticsShipmentItems.productName,
          vintage: logisticsShipmentItems.vintage,
          cases: logisticsShipmentItems.cases,
          bottlesPerCase: logisticsShipmentItems.bottlesPerCase,
          bottleSizeMl: logisticsShipmentItems.bottleSizeMl,
        })
        .from(logisticsShipmentItems)
        .where(
          and(
            eq(logisticsShipmentItems.shipmentId, shipmentId),
            or(isNull(logisticsShipmentItems.overrideOwnerId), eq(logisticsShipmentItems.overrideOwnerId, partner.id)),
          ),
        ),
      db
        .select({ status: logisticsShipmentActivityLogs.newStatus, at: logisticsShipmentActivityLogs.createdAt })
        .from(logisticsShipmentActivityLogs)
        .where(and(eq(logisticsShipmentActivityLogs.shipmentId, shipmentId), isNotNull(logisticsShipmentActivityLogs.newStatus)))
        .orderBy(asc(logisticsShipmentActivityLogs.createdAt)),
      db
        .select({ at: wmsStockMovements.performedAt })
        .from(wmsStockMovements)
        .where(and(eq(wmsStockMovements.shipmentId, shipmentId), eq(wmsStockMovements.movementType, 'receive')))
        .orderBy(asc(wmsStockMovements.performedAt)),
    ]);

    const first = (statuses: string[]) => changes.find((change) => change.status && statuses.includes(change.status))?.at ?? null;

    const email = buildShipmentPartnerEmail(
      milestone,
      {
        shipmentNumber: shipment.shipmentNumber,
        transportMode: shipment.transportMode,
        eta: shipment.eta,
        departedAt: shipment.atd ?? first(['in_transit']),
        arrivedAt: first(['arrived_port']) ?? shipment.ata,
        receivedAt: receipts.at(-1)?.at ?? shipment.deliveredAt,
        wines: items.map((item) => ({
          name: item.name,
          vintage: item.vintage,
          cases: item.cases,
          bottlesPerCase: item.bottlesPerCase ?? 12,
          bottleSizeMl: item.bottleSizeMl ?? 750,
        })),
      },
      {
        shipmentUrl: `${serverConfig.appUrl}/platform/partner/logistics/${shipmentId}`,
        stockUrl: `${serverConfig.appUrl}/platform/partner/stock`,
      },
      partner.name,
    );

    // The business address, or one person on the account: never every login
    const people = await getPartnerUsers(partner.id);
    const to = partner.email?.trim() || people.at(0)?.email?.trim();
    if (!to) {
      logger.warn('Shipment email skipped: no address on the partner', { shipmentId, partnerId: partner.id });
      return;
    }

    const data = { ...email.data };
    if (mode === 'shadow') data.subject = `[SHADOW for ${partner.name} <${to}>] ${data.subject}`;

    await loops.sendTransactionalEmail({
      transactionalId: ORDER_EMAIL_TEMPLATE_ID,
      email: mode === 'live' ? to : ORDER_EMAIL_SHADOW_INBOX,
      dataVariables: data as unknown as TransactionalVariables,
    });

    if (mode === 'live') {
      const userIds = [...new Set(people.map((person) => person.id))];
      for (const userId of userIds) {
        await createNotification({
          userId,
          type: 'shipment_status_changed',
          title: `Shipment ${shipment.shipmentNumber} ${LABELS[milestone]}`,
          message: email.data.body,
          entityType: 'logistics_shipment',
          entityId: shipmentId,
          actionUrl: `/platform/partner/logistics/${shipmentId}`,
          metadata: { shipmentNumber: shipment.shipmentNumber, milestone },
        }).catch(() => undefined);
      }
    }

    // Not stamped with the partner: their own log lines show on their shipment page
    await db.insert(logisticsShipmentActivityLogs).values({
      shipmentId,
      action: NOTIFIED,
      notes: `${partner.name} told the shipment has ${LABELS[milestone]} (${mode === 'live' ? `emailed ${to}` : 'shadow, to Kevin'})`,
      metadata: { milestone, mode, to, partnerId: partner.id },
    });
  } catch (error) {
    logger.error('Shipment partner notification failed', {
      shipmentId,
      milestone,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/** The partner milestone a shipment status reaches, if any */
export const milestoneForStatus = (status: string): ShipmentMilestone | null => {
  if (status === 'in_transit') return 'departed';
  if (['arrived_port', 'customs_clearance', 'cleared', 'at_warehouse', 'partially_received'].includes(status)) return 'arrived';
  if (status === 'delivered') return 'received';
  return null;
};

export default notifyPartnerOfShipment;

