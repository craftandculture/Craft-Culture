import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { logisticsShipmentActivityLogs, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import createShipmentSchema from '../schemas/createShipmentSchema';
import generateShipmentNumber from '../utils/generateShipmentNumber';

/**
 * Create a new logistics shipment
 *
 * @example
 *   await trpcClient.logistics.admin.create.mutate({
 *     type: "inbound",
 *     transportMode: "sea_fcl",
 *     partnerId: "uuid",
 *     originCountry: "France",
 *     originCity: "Bordeaux"
 *   });
 */
const adminCreate = adminProcedure
  .input(createShipmentSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    try {
      const shipmentNumber = await generateShipmentNumber();

      const [shipment] = await db
        .insert(logisticsShipments)
        .values({
          shipmentNumber,
          type: input.type,
          transportMode: input.transportMode,
          status: 'draft',
          partnerId: input.partnerId,
          clientContactId: input.clientContactId,
          originCountry: input.originCountry,
          originCity: input.originCity,
          originWarehouse: input.originWarehouse,
          destinationCountry: input.destinationCountry,
          destinationCity: input.destinationCity,
          destinationWarehouse: input.destinationWarehouse,
          carrierName: input.carrierName,
          carrierBookingRef: input.carrierBookingRef,
          containerNumber: input.containerNumber,
          blNumber: input.blNumber,
          awbNumber: input.awbNumber,
          etd: input.etd,
          eta: input.eta,
          internalNotes: input.internalNotes,
          partnerNotes: input.partnerNotes,
          createdBy: user.id,
        })
        .returning();

      if (!shipment) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create shipment',
        });
      }

      // Log the creation
      await db.insert(logisticsShipmentActivityLogs).values({
        shipmentId: shipment.id,
        userId: user.id,
        action: 'created',
        newStatus: 'draft',
        notes: `Shipment ${shipmentNumber} created`,
      });

      return shipment;
    } catch (error) {
      logger.error('Error creating shipment:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create shipment. Please try again.',
      });
    }
  });

export default adminCreate;
