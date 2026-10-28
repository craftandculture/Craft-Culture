import { inArray } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';

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
    }
  >();
  if (!shipmentIds.length) return byIntake;

  const [shipments, items] = await Promise.all([
    db
      .select({
        id: logisticsShipments.id,
        shipmentNumber: logisticsShipments.shipmentNumber,
        status: logisticsShipments.status,
        transportMode: logisticsShipments.transportMode,
        partnerId: logisticsShipments.partnerId,
        eta: logisticsShipments.eta,
        ata: logisticsShipments.ata,
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
  ]);

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
    });
  }

  return byIntake;
};

export default getIntakeShipments;
