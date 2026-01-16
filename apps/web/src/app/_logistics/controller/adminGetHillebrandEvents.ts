import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { getHillebrandShipmentEvents } from '../integrations/hillebrand';

const inputSchema = z.object({
  shipmentId: z.string(),
});

/**
 * Get tracking events from Hillebrand for a shipment
 */
const adminGetHillebrandEvents = adminProcedure.input(inputSchema).query(async ({ input }: { input: z.infer<typeof inputSchema> }) => {
  const { shipmentId } = input;

  // Get the shipment to find the Hillebrand ID
  const [shipment] = await db
    .select({
      hillebrandShipmentId: logisticsShipments.hillebrandShipmentId,
    })
    .from(logisticsShipments)
    .where(eq(logisticsShipments.id, shipmentId))
    .limit(1);

  if (!shipment?.hillebrandShipmentId) {
    return { events: [] };
  }

  try {
    const response = await getHillebrandShipmentEvents(shipment.hillebrandShipmentId);
    return { events: response.events ?? [] };
  } catch (error) {
    logger.error('Failed to fetch Hillebrand events', { shipmentId, error });
    return { events: [] };
  }
});

export default adminGetHillebrandEvents;
