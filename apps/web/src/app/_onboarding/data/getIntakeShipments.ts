import { and, asc, inArray, isNotNull } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentActivityLogs, logisticsShipmentItems, logisticsShipments } from '@/database/schema';

import intakeRouteOf from '../utils/intakeRouteOf';
import intakeStageFromShipment from '../utils/intakeStageFromShipment';

interface IntakeRef {
  id: string;
  partnerId: string | null;
  shipmentId: string | null;
  source: string;
  route: string | null;
}

/**
 * The shipment behind each linked transfer, and the member's wines on it
 *
 * A line is the member's when it is assigned to them, or when it is not
 * assigned to anyone and the shipment itself is theirs — the same rule
 * receiving uses to decide whose cellar a case lands in, so what the card
 * shows is what arrives.
 *
 * Each shipment also carries when it first reached each status, from its
 * activity log, so the member's tracker can date every step.
 *
 * @param intakes - Transfers, with the member they belong to
 * @returns Shipment summary keyed by transfer id; unlinked transfers are absent
 */
const getIntakeShipments = async (intakes: IntakeRef[]) => {
  const shipmentIds = [...new Set(intakes.map((intake) => intake.shipmentId).filter((id): id is string => Boolean(id)))];
  const byIntake = new Map<
    string,
    {
      shipmentId: string;
      shipmentNumber: string;
      status: string;
      impliedStage: ReturnType<typeof intakeStageFromShipment>;
      transportMode: string;
      eta: Date | null;
      arrivedAt: Date | null;
      wines: { name: string; vintage: number | null; cases: number; bottlesPerCase: number; bottleSizeMl: number }[];
      memberCases: number;
      memberBottles: number;
      reachedAt: Record<string, string>;
    }
  >();
  if (!shipmentIds.length) return byIntake;

  const [shipments, items, statusChanges] = await Promise.all([
    db
      .select({
        id: logisticsShipments.id,
        shipmentNumber: logisticsShipments.shipmentNumber,
        status: logisticsShipments.status,
        transportMode: logisticsShipments.transportMode,
        partnerId: logisticsShipments.partnerId,
        eta: logisticsShipments.eta,
        atd: logisticsShipments.atd,
        ata: logisticsShipments.ata,
        deliveredAt: logisticsShipments.deliveredAt,
      })
      .from(logisticsShipments)
      .where(inArray(logisticsShipments.id, shipmentIds)),
    db
      .select({
        shipmentId: logisticsShipmentItems.shipmentId,
        productName: logisticsShipmentItems.productName,
        vintage: logisticsShipmentItems.vintage,
        cases: logisticsShipmentItems.cases,
        bottlesPerCase: logisticsShipmentItems.bottlesPerCase,
        bottleSizeMl: logisticsShipmentItems.bottleSizeMl,
        overrideOwnerId: logisticsShipmentItems.overrideOwnerId,
      })
      .from(logisticsShipmentItems)
      .where(inArray(logisticsShipmentItems.shipmentId, shipmentIds)),
    db
      .select({
        shipmentId: logisticsShipmentActivityLogs.shipmentId,
        status: logisticsShipmentActivityLogs.newStatus,
        at: logisticsShipmentActivityLogs.createdAt,
      })
      .from(logisticsShipmentActivityLogs)
      .where(
        and(
          inArray(logisticsShipmentActivityLogs.shipmentId, shipmentIds),
          isNotNull(logisticsShipmentActivityLogs.newStatus),
        ),
      )
      .orderBy(asc(logisticsShipmentActivityLogs.createdAt)),
  ]);

  // First time each shipment reached each status; the recorded departure,
  // arrival and delivery dates win where the team filled them in
  const reachedAtFor = (shipment: (typeof shipments)[number]) => {
    const reached: Record<string, string> = {};
    for (const change of statusChanges) {
      if (change.shipmentId === shipment.id && change.status && !reached[change.status]) {
        reached[change.status] = change.at.toISOString();
      }
    }
    if (shipment.atd) reached.in_transit = shipment.atd.toISOString();
    if (shipment.ata) reached.arrived_port = shipment.ata.toISOString();
    if (shipment.deliveredAt) reached.delivered = shipment.deliveredAt.toISOString();
    return reached;
  };

  for (const intake of intakes) {
    const shipment = shipments.find((item) => item.id === intake.shipmentId);
    if (!shipment) continue;

    const wines = items
      .filter(
        (item) =>
          item.shipmentId === shipment.id &&
          (item.overrideOwnerId ? item.overrideOwnerId === intake.partnerId : shipment.partnerId === intake.partnerId),
      )
      .map((item) => ({
        name: item.productName,
        vintage: item.vintage,
        cases: item.cases,
        bottlesPerCase: item.bottlesPerCase ?? 12,
        bottleSizeMl: item.bottleSizeMl ?? 750,
      }));

    byIntake.set(intake.id, {
      shipmentId: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      status: shipment.status,
      impliedStage: intakeStageFromShipment(shipment.status, intakeRouteOf(intake)),
      transportMode: shipment.transportMode,
      eta: shipment.eta,
      arrivedAt: shipment.ata,
      wines,
      memberCases: wines.reduce((sum, wine) => sum + wine.cases, 0),
      memberBottles: wines.reduce((sum, wine) => sum + wine.cases * wine.bottlesPerCase, 0),
      reachedAt: reachedAtFor(shipment),
    });
  }

  return byIntake;
};

export default getIntakeShipments;
