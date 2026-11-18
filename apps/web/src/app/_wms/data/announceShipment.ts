import { and, asc, eq, inArray } from 'drizzle-orm';

import { SHIPMENT_MILESTONES, type ShipmentMilestone } from '@/app/_logistics/utils/buildShipmentPartnerEmail';
import db from '@/database/client';
import {
  logisticsShipmentActivityLogs,
  logisticsShipmentItems,
  logisticsShipments,
  partners,
  users,
  wmsLocations,
  wmsStockMovements,
} from '@/database/schema';
import escapeSlackText from '@/lib/slack/escapeSlackText';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import postWarehouseSlack from '../utils/postWarehouseSlack';

/** The activity log line that records the post, and stops a repeat. Hidden from partners (no status, no partner) */
const POSTED = 'warehouse_slack_posted';

const day = (date: Date | null) =>
  date
    ? date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' })
    : null;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Tell #warehouse-activity about an inbound shipment: when it departs, when it
 * reaches the UAE, when the first case is scanned at the warehouse, and when
 * it is all on the shelf
 *
 * The warehouse only heard about picks and dispatches, so cargo arrived
 * without warning and nobody saw it go on the shelf. Each moment is posted
 * once and never after a later one, as the partner emails are. Receipts list
 * each wine with the bay it went to and call out any case short or over.
 *
 * Never throws: a status change or receipt stands whether or not Slack hears.
 *
 * @example
 *   await announceShipment(shipmentId, 'received');
 *
 * @param shipmentId - The shipment
 * @param milestone - The moment it has reached
 * @param options - force: post even if this moment was posted before (a resend)
 * @returns null when posted or rightly skipped, otherwise why it did not go
 */
const announceShipment = async (
  shipmentId: string,
  milestone: ShipmentMilestone,
  { force = false }: { force?: boolean } = {},
) => {
  try {
    const [shipment] = await db
      .select({
        id: logisticsShipments.id,
        number: logisticsShipments.shipmentNumber,
        name: logisticsShipments.name,
        type: logisticsShipments.type,
        mode: logisticsShipments.transportMode,
        originCity: logisticsShipments.originCity,
        originCountry: logisticsShipments.originCountry,
        carrier: logisticsShipments.carrierName,
        awb: logisticsShipments.awbNumber,
        bl: logisticsShipments.blNumber,
        eta: logisticsShipments.eta,
        owner: partners.businessName,
      })
      .from(logisticsShipments)
      .leftJoin(partners, eq(partners.id, logisticsShipments.partnerId))
      .where(eq(logisticsShipments.id, shipmentId))
      .limit(1);
    if (!shipment) return 'Shipment not found';
    if (shipment.type !== 'inbound') return 'Only inbound shipments are posted';

    // Once per moment, and never after a later one
    const posted = await db
      .select({ metadata: logisticsShipmentActivityLogs.metadata })
      .from(logisticsShipmentActivityLogs)
      .where(and(eq(logisticsShipmentActivityLogs.shipmentId, shipmentId), eq(logisticsShipmentActivityLogs.action, POSTED)));
    const furthest = Math.max(
      -1,
      ...posted.map((row) =>
        SHIPMENT_MILESTONES.indexOf((row.metadata as { milestone?: ShipmentMilestone } | null)?.milestone ?? 'departed'),
      ),
    );
    if (!force && SHIPMENT_MILESTONES.indexOf(milestone) <= furthest) return null;

    // Recorded first, so two cases scanned at once do not both post
    await db.insert(logisticsShipmentActivityLogs).values({
      shipmentId,
      action: POSTED,
      notes: `Posted to #warehouse-activity: ${milestone}`,
      metadata: { milestone },
    });

    const items = await db
      .select({
        name: logisticsShipmentItems.productName,
        vintage: logisticsShipmentItems.vintage,
        cases: logisticsShipmentItems.cases,
        bottlesPerCase: logisticsShipmentItems.bottlesPerCase,
      })
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, shipmentId))
      .orderBy(asc(logisticsShipmentItems.sortOrder), asc(logisticsShipmentItems.createdAt));

    const expectedCases = items.reduce((sum, item) => sum + (item.cases ?? 0), 0);
    const expectedBottles = items.reduce((sum, item) => sum + (item.cases ?? 0) * (item.bottlesPerCase ?? 12), 0);

    const link = `<${serverConfig.appUrl}/platform/admin/logistics/shipments/${shipment.id}|${escapeSlackText(shipment.number)}>`;
    const who = [shipment.owner, shipment.name].filter(Boolean).map((s) => escapeSlackText(s!)).join(' · ');
    const from = [shipment.originCity, shipment.originCountry].filter(Boolean).join(', ');
    const ref = shipment.awb ? `AWB ${shipment.awb}` : shipment.bl ? `B/L ${shipment.bl}` : null;
    const size = `${plural(expectedCases, 'case')} · ${plural(expectedBottles, 'bottle')}`;

    let text: string;

    if (milestone === 'departed' || milestone === 'arrived') {
      const head =
        milestone === 'departed'
          ? `:airplane_departure: *Inbound* ${link}${who ? ` — ${who}` : ''}`
          : `:anchor: *Arrived in the UAE* ${link}${who ? ` — ${who}` : ''}, clearing to the warehouse`;
      const meta = [
        size,
        milestone === 'departed' && from ? `from ${escapeSlackText(from)}` : null,
        shipment.eta ? `ETA ${day(shipment.eta)}` : null,
        shipment.carrier ? escapeSlackText(shipment.carrier) : null,
        ref ? escapeSlackText(ref) : null,
      ]
        .filter(Boolean)
        .join(' · ');
      const lines = items
        .slice(0, 10)
        .map((item) => `• ${item.cases} cs  ${escapeSlackText(item.name)}${item.vintage ? ` ${item.vintage}` : ''}`);
      if (items.length > 10) lines.push(`…and ${items.length - 10} more lines`);
      text = [head, meta, lines.join('\n')].filter(Boolean).join('\n');
    } else {
      // What has actually been received, from the receive movements
      const receipts = await db
        .select({
          name: wmsStockMovements.productName,
          cases: wmsStockMovements.quantityCases,
          bottles: wmsStockMovements.quantityBottles,
          locationId: wmsStockMovements.toLocationId,
          by: wmsStockMovements.performedBy,
          at: wmsStockMovements.performedAt,
        })
        .from(wmsStockMovements)
        .where(and(eq(wmsStockMovements.shipmentId, shipmentId), eq(wmsStockMovements.movementType, 'receive')))
        .orderBy(asc(wmsStockMovements.performedAt));

      const locationIds = [...new Set(receipts.map((r) => r.locationId).filter((id): id is string => !!id))];
      const userIds = [...new Set(receipts.map((r) => r.by).filter((id): id is string => !!id))];
      const [locations, people] = await Promise.all([
        locationIds.length
          ? db
              .select({ id: wmsLocations.id, code: wmsLocations.locationCode })
              .from(wmsLocations)
              .where(inArray(wmsLocations.id, locationIds))
          : [],
        userIds.length ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)) : [],
      ]);
      const codeOf = new Map(locations.map((l) => [l.id, l.code]));
      const firstNames = [
        ...new Set(people.map((p) => (p.name ?? '').split(' ')[0]).filter((n): n is string => !!n)),
      ];

      if (milestone === 'landed') {
        text = [
          `:inbox_tray: *At the warehouse, receiving started* ${link}${who ? ` — ${who}` : ''}`,
          [`${size} expected`, firstNames.length ? `by ${escapeSlackText(firstNames.join(', '))}` : null]
            .filter(Boolean)
            .join(' · '),
        ].join('\n');
      } else {
        // One line per wine, with the bays it went to
        const byWine = new Map<string, { cases: number; bottles: number; bays: Set<string> }>();
        for (const r of receipts) {
          const row = byWine.get(r.name) ?? { cases: 0, bottles: 0, bays: new Set<string>() };
          row.cases += r.cases ?? 0;
          row.bottles += r.bottles ?? 0;
          const code = r.locationId ? codeOf.get(r.locationId) : null;
          if (code) row.bays.add(code);
          byWine.set(r.name, row);
        }
        const receivedCases = [...byWine.values()].reduce((sum, row) => sum + row.cases, 0);
        const diff = receivedCases - expectedCases;
        const started = receipts.at(0)?.at;
        const finished = receipts.at(-1)?.at;
        const minutes = started && finished ? Math.round((finished.getTime() - started.getTime()) / 60000) : null;
        const took = minutes === null ? null : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

        const lines = [...byWine.entries()].slice(0, 15).map(([name, row]) => {
          const qty = row.cases > 0 ? `${row.cases} cs` : `${row.bottles} btl`;
          const bays = [...row.bays];
          return `• ${qty}  ${escapeSlackText(name)}${bays.length ? `  _${escapeSlackText(bays.join(', '))}_` : ''}`;
        });
        if (byWine.size > 15) lines.push(`…and ${byWine.size - 15} more lines`);

        text = [
          `:white_check_mark: *On the shelf* ${link}${who ? ` — ${who}` : ''}`,
          [
            expectedCases ? `${receivedCases} of ${plural(expectedCases, 'case')} received` : plural(receivedCases, 'case'),
            diff !== 0 && expectedCases ? `:warning: ${Math.abs(diff)} ${diff < 0 ? 'short' : 'over'}` : null,
            firstNames.length ? `by ${escapeSlackText(firstNames.join(', '))}` : null,
            took,
          ]
            .filter(Boolean)
            .join(' · '),
          lines.join('\n'),
        ]
          .filter(Boolean)
          .join('\n');
      }
    }

    return await postWarehouseSlack(text);
  } catch (error) {
    // Best effort only: never fail the warehouse action, but leave a trace
    logger.error('Warehouse activity: could not post the shipment', {
      shipmentId,
      milestone,
      error: error instanceof Error ? error.message : String(error),
    });
    return error instanceof Error ? error.message : String(error);
  }
};

export default announceShipment;
