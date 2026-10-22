import { and, eq, ne } from 'drizzle-orm';

import db from '@/database/client';
import { cellarIntakes, logisticsShipments } from '@/database/schema';
import logger from '@/utils/logger';

import notifyIntakeStage from './notifyIntakeStage';
import intakeRouteOf from '../utils/intakeRouteOf';
import intakeStageFromShipment from '../utils/intakeStageFromShipment';
import laterIntakeStage from '../utils/laterIntakeStage';

/**
 * Move every transfer linked to a shipment up to the stage its status implies
 *
 * Called wherever a shipment's status is written. Members are told of each
 * stage reached, once, because the stage is stored. Never throws: a member's
 * tracker is not worth failing a shipment update or a receipt over — and the
 * cellar reads the shipment directly too, so a missed call only costs the
 * message, not the tracker.
 *
 * @param shipmentId - The shipment whose status just changed
 */
const advanceShipmentIntakes = async (shipmentId: string) => {
  try {
    const [shipment] = await db
      .select({ status: logisticsShipments.status })
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, shipmentId))
      .limit(1);

    if (!shipment) return;

    const linked = await db
      .select()
      .from(cellarIntakes)
      .where(and(eq(cellarIntakes.shipmentId, shipmentId), ne(cellarIntakes.stage, 'closed')));

    for (const intake of linked) {
      const implied = intakeStageFromShipment(shipment.status, intakeRouteOf(intake));
      const next = laterIntakeStage(intake.stage, implied);
      if (next === intake.stage) continue;

      await db.update(cellarIntakes).set({ stage: next }).where(eq(cellarIntakes.id, intake.id));

      if (intake.partnerId) {
        await notifyIntakeStage({
          partnerId: intake.partnerId,
          source: intake.source,
          holderName: intake.holderName,
          route: intake.route,
          stage: next,
        });
      }
    }
  } catch (error) {
    logger.error('Could not advance transfers linked to shipment', { error, shipmentId });
  }
};

export default advanceShipmentIntakes;
