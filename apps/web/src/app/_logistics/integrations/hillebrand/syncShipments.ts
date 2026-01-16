import { desc, eq, like } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipments } from '@/database/schema';
import logger from '@/utils/logger';

import {
  getAllHillebrandShipments,
  getHillebrandShipment,
  getHillebrandShipments,
} from './getShipments';
import type { HillebrandShipment } from './getShipments';

/**
 * Parse a date string from Hillebrand API
 */
const parseHillebrandDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Calculate total cases from cargo items
 */
const calculateCargoTotals = (shipment: HillebrandShipment) => {
  const cargoItems = shipment.cargo || shipment.cargoItems || shipment.items || [];

  let totalCases = 0;
  let totalBottles = 0;
  let totalWeightKg = 0;
  let totalVolumeM3 = 0;

  for (const item of cargoItems) {
    // Try to get number of cases/packages
    const packages = item.numberOfPackages || item.quantity || 0;
    totalCases += packages;

    // Estimate bottles (assuming 6 or 12 per case typically)
    // This is rough - will be refined when syncing items
    if (packages > 0) {
      totalBottles += packages * 6; // Default assumption
    }

    // Weight in kg
    if (item.grossWeight) {
      const weight = item.grossWeight;
      if (item.grossWeightUnit?.toLowerCase() === 'lb') {
        totalWeightKg += weight * 0.453592;
      } else {
        totalWeightKg += weight; // Assume kg
      }
    }

    // Volume in m3
    if (item.volume) {
      const volume = item.volume;
      if (item.volumeUnit?.toLowerCase() === 'cbf' || item.volumeUnit?.toLowerCase() === 'ft3') {
        totalVolumeM3 += volume * 0.0283168;
      } else {
        totalVolumeM3 += volume; // Assume m3
      }
    }
  }

  // If no cargo items but shipment has totals, use those
  if (totalCases === 0 && shipment.numberOfPackages) {
    totalCases = shipment.numberOfPackages;
  }
  if (totalCases === 0 && shipment.numberOfPieces) {
    totalCases = shipment.numberOfPieces;
  }
  if (totalWeightKg === 0 && shipment.totalWeight) {
    totalWeightKg = shipment.totalWeight;
    if (shipment.totalWeightUnit?.toLowerCase() === 'lb') {
      totalWeightKg *= 0.453592;
    }
  }
  if (totalVolumeM3 === 0 && shipment.totalVolume) {
    totalVolumeM3 = shipment.totalVolume;
  }

  return {
    totalCases: totalCases > 0 ? totalCases : null,
    totalBottles: totalBottles > 0 ? totalBottles : null,
    totalWeightKg: totalWeightKg > 0 ? Math.round(totalWeightKg * 100) / 100 : null,
    totalVolumeM3: totalVolumeM3 > 0 ? Math.round(totalVolumeM3 * 1000) / 1000 : null,
  };
};

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

    logger.info('Initial Hillebrand fetch result', {
      count: hillebrandShipments.length,
      sample: hillebrandShipments.slice(0, 2).map(s => ({
        id: s.id,
        status: s.status,
        shipFrom: s.shipFromPartyName,
        shipTo: s.shipToPartyName,
      })),
    });

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
        // Fetch detailed shipment info (has more data than list endpoint)
        let detailedShipment: HillebrandShipment;
        try {
          detailedShipment = await getHillebrandShipment(hShipment.id);
        } catch (detailError) {
          logger.warn('Could not fetch shipment details, using list data', {
            hillebrandId: hShipment.id,
            error: detailError,
          });
          detailedShipment = hShipment;
        }

        // Check if we already have this shipment
        const [existing] = await db
          .select({ id: logisticsShipments.id, shipmentNumber: logisticsShipments.shipmentNumber })
          .from(logisticsShipments)
          .where(eq(logisticsShipments.hillebrandShipmentId, hShipment.id))
          .limit(1);

        // Extract timeline dates (try multiple field names)
        const etd = parseHillebrandDate(
          detailedShipment.etd || detailedShipment.estimatedDepartureDate,
        );
        const atd = parseHillebrandDate(
          detailedShipment.atd || detailedShipment.actualDepartureDate,
        );
        const eta = parseHillebrandDate(
          detailedShipment.eta || detailedShipment.estimatedArrivalDate,
        );
        const ata = parseHillebrandDate(
          detailedShipment.ata || detailedShipment.actualArrivalDate,
        );
        const deliveredAt = parseHillebrandDate(detailedShipment.deliveredDate);

        // Calculate cargo totals
        const cargoTotals = calculateCargoTotals(detailedShipment);

        // Extract Bill of Lading number
        const blNumber =
          detailedShipment.billOfLadingNumber ||
          detailedShipment.blNumber ||
          detailedShipment.masterBillNumber ||
          detailedShipment.houseBillNumber ||
          null;

        const shipmentData = {
          type: 'inbound' as const,
          transportMode: mapHillebrandModality(detailedShipment.mainModality),
          status: mapHillebrandStatus(detailedShipment.status),
          hillebrandShipmentId: detailedShipment.id,
          hillebrandReference: getHillebrandReference(detailedShipment),
          hillebrandLastSync: new Date(),
          // Origin
          originCountry:
            detailedShipment.shipFromLocation?.countryName ??
            detailedShipment.shipFromLocation?.countryCode,
          originCity: detailedShipment.shipFromLocation?.cityName,
          // Destination
          destinationCountry:
            detailedShipment.shipToLocation?.countryName ??
            detailedShipment.shipToLocation?.countryCode ??
            'UAE',
          destinationCity: detailedShipment.shipToLocation?.cityName ?? 'Ras Al Khaimah',
          destinationWarehouse: 'RAK Port',
          // Carrier info
          carrierName: 'Hillebrand',
          containerNumber: detailedShipment.equipment?.number,
          blNumber,
          // Timeline
          etd,
          atd,
          eta,
          ata,
          deliveredAt,
          // Cargo
          totalCases: cargoTotals.totalCases,
          totalBottles: cargoTotals.totalBottles,
          totalWeightKg: cargoTotals.totalWeightKg,
          totalVolumeM3: cargoTotals.totalVolumeM3,
          // Emissions
          co2EmissionsTonnes: detailedShipment.emission?.value,
          // Notes
          partnerNotes: `Supplier: ${detailedShipment.shipFromPartyName ?? 'Unknown'}`,
        };

        logger.info('Syncing shipment with detailed data', {
          hillebrandId: detailedShipment.id,
          etd,
          eta,
          atd,
          ata,
          totalCases: cargoTotals.totalCases,
          totalWeightKg: cargoTotals.totalWeightKg,
          blNumber,
        });

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
            hillebrandId: detailedShipment.id,
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
            hillebrandId: detailedShipment.id,
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
