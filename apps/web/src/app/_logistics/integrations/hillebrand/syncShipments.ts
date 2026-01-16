import { desc, eq, like } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipments } from '@/database/schema';
import logger from '@/utils/logger';

import { getAllHillebrandShipments, getHillebrandShipments } from './getShipments';
import type { HillebrandShipment } from './getShipments';

type OurShipmentStatus =
  | 'draft'
  | 'booked'
  | 'picked_up'
  | 'in_transit'
  | 'arrived_port'
  | 'customs_clearance'
  | 'cleared'
  | 'at_warehouse'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

type OurTransportMode = 'sea_fcl' | 'sea_lcl' | 'air' | 'road';

/**
 * Map Hillebrand status to our shipment status enum
 *
 * Hillebrand statuses: shipped, departed, arrived, delivered, etc.
 */
const mapHillebrandStatus = (status: string): OurShipmentStatus => {
  const statusMap: Record<string, OurShipmentStatus> = {
    // Active shipment statuses
    shipped: 'in_transit',
    departed: 'in_transit',
    'in transit': 'in_transit',
    in_transit: 'in_transit',
    arrived: 'arrived_port',
    delivered: 'delivered',
    collected: 'picked_up',
    booked: 'booked',
    // Default to in_transit for unknown active statuses
  };

  return statusMap[status.toLowerCase()] ?? 'in_transit';
};

/**
 * Map Hillebrand transport modality to our transport mode enum
 *
 * Hillebrand modalities: air, maritime, road
 */
const mapHillebrandModality = (modality: string | undefined): OurTransportMode => {
  if (!modality) return 'sea_fcl';

  const modalityMap: Record<string, OurTransportMode> = {
    air: 'air',
    maritime: 'sea_fcl',
    sea: 'sea_fcl',
    ocean: 'sea_fcl',
    road: 'road',
    truck: 'road',
  };

  return modalityMap[modality.toLowerCase()] ?? 'sea_fcl';
};

/**
 * Generate a shipment number for Hillebrand imports
 */
const generateHillebrandShipmentNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `HB-${year}`;

  // Get the latest Hillebrand shipment number for this year
  const [latest] = await db
    .select({ shipmentNumber: logisticsShipments.shipmentNumber })
    .from(logisticsShipments)
    .where(like(logisticsShipments.shipmentNumber, `${prefix}-%`))
    .orderBy(desc(logisticsShipments.shipmentNumber))
    .limit(1);

  let nextNumber = 1;
  if (latest?.shipmentNumber) {
    const match = latest.shipmentNumber.match(/HB-\d{4}-(\d+)/);
    if (match?.[1]) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
};

/**
 * Get the Hillebrand reference from the shipment references array
 */
const getHillebrandReference = (shipment: HillebrandShipment): string | undefined => {
  // Look for customer reference
  const customerRef = shipment.references?.find(
    (r) => r.role === 'serviceCustomer' || r.role === 'customer',
  );
  return customerRef?.reference;
};

interface SyncResult {
  created: number;
  updated: number;
  errors: number;
  shipments: Array<{
    hillebrandId: number;
    shipmentNumber: string;
    action: 'created' | 'updated' | 'error';
    error?: string;
  }>;
}

/**
 * Sync shipments from Hillebrand API to our database
 *
 * Creates new shipments or updates existing ones based on hillebrandShipmentId.
 * All synced shipments are type 'inbound' since they're coming to C&C warehouse.
 */
const syncHillebrandShipments = async (): Promise<SyncResult> => {
  const result: SyncResult = {
    created: 0,
    updated: 0,
    errors: 0,
    shipments: [],
  };

  try {
    // First try without status filter to get all shipments
    logger.info('Fetching Hillebrand shipments (no status filter)');
    const hillebrandShipments = await getAllHillebrandShipments({ pageSize: 100 });

    // If no results, try with specific status filters
    if (hillebrandShipments.length === 0) {
      logger.info('No shipments found without filter, trying with status filters');

      // Valid Hillebrand API statuses (based on API documentation)
      const statusesToTry = ['shipped', 'arrived', 'delivered'];
      const seenIds = new Set<number>();

      for (const status of statusesToTry) {
        try {
          logger.info(`Trying Hillebrand status: ${status}`);
          const shipments = await getHillebrandShipments({ status, pageSize: 100 });

          for (const shipment of shipments) {
            if (!seenIds.has(shipment.id)) {
              seenIds.add(shipment.id);
              hillebrandShipments.push(shipment);
            }
          }
        } catch (error) {
          logger.warn(`Failed to fetch shipments with status ${status}`, { error });
        }
      }
    }

    logger.info('Syncing Hillebrand shipments', { count: hillebrandShipments.length });

    for (const hShipment of hillebrandShipments) {
      try {
        // Check if we already have this shipment
        const [existing] = await db
          .select({ id: logisticsShipments.id, shipmentNumber: logisticsShipments.shipmentNumber })
          .from(logisticsShipments)
          .where(eq(logisticsShipments.hillebrandShipmentId, hShipment.id))
          .limit(1);

        const shipmentData = {
          type: 'inbound' as const,
          transportMode: mapHillebrandModality(hShipment.mainModality),
          status: mapHillebrandStatus(hShipment.status),
          hillebrandShipmentId: hShipment.id,
          hillebrandReference: getHillebrandReference(hShipment),
          hillebrandLastSync: new Date(),
          // Origin
          originCountry: hShipment.shipFromLocation?.countryName ?? hShipment.shipFromLocation?.countryCode,
          originCity: hShipment.shipFromLocation?.cityName,
          // Destination
          destinationCountry: hShipment.shipToLocation?.countryName ?? hShipment.shipToLocation?.countryCode ?? 'UAE',
          destinationCity: hShipment.shipToLocation?.cityName ?? 'Ras Al Khaimah',
          destinationWarehouse: 'RAK Port',
          // Carrier info
          carrierName: 'Hillebrand',
          containerNumber: hShipment.equipment?.number,
          // Emissions
          co2EmissionsTonnes: hShipment.emission?.value,
          // Notes
          partnerNotes: `Supplier: ${hShipment.shipFromPartyName ?? 'Unknown'}`,
        };

        if (existing) {
          // Update existing shipment
          await db
            .update(logisticsShipments)
            .set({
              ...shipmentData,
              updatedAt: new Date(),
            })
            .where(eq(logisticsShipments.id, existing.id));

          result.updated++;
          result.shipments.push({
            hillebrandId: hShipment.id,
            shipmentNumber: existing.shipmentNumber,
            action: 'updated',
          });
        } else {
          // Create new shipment
          const shipmentNumber = await generateHillebrandShipmentNumber();

          const [newShipment] = await db
            .insert(logisticsShipments)
            .values({
              shipmentNumber,
              ...shipmentData,
            })
            .returning();

          result.created++;
          result.shipments.push({
            hillebrandId: hShipment.id,
            shipmentNumber: newShipment?.shipmentNumber ?? shipmentNumber,
            action: 'created',
          });
        }
      } catch (error) {
        result.errors++;
        result.shipments.push({
          hillebrandId: hShipment.id,
          shipmentNumber: '',
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        logger.error('Error syncing Hillebrand shipment', {
          hillebrandId: hShipment.id,
          error,
        });
      }
    }

    logger.info('Hillebrand sync complete', {
      created: result.created,
      updated: result.updated,
      errors: result.errors,
    });

    return result;
  } catch (error) {
    logger.error('Failed to sync Hillebrand shipments', { error });
    throw error;
  }
};

export default syncHillebrandShipments;

export type { SyncResult };
