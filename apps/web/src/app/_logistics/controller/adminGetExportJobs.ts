import { desc, eq } from 'drizzle-orm';

import dubaiToday from '@/app/_teamTasks/utils/dubaiToday';
import db from '@/database/client';
import { logisticsJobs, logisticsMovementBonds, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { bondStatus } from '../utils/bondStatus';
import { exportModeOf } from '../utils/exportStages';

/**
 * Every export job, newest first, with where its bond stands
 *
 * The bond's step and deadline are worked out here, against Dubai's date, so
 * the list, the tiles and the logistics dashboard all read them the same way.
 */
const adminGetExportJobs = adminProcedure.query(async () => {
  const today = dubaiToday();

  const rows = await db
    .select({
      job: logisticsJobs,
      shipment: {
        id: logisticsShipments.id,
        shipmentNumber: logisticsShipments.shipmentNumber,
        transportMode: logisticsShipments.transportMode,
        originCity: logisticsShipments.originCity,
        originCountry: logisticsShipments.originCountry,
        destinationCity: logisticsShipments.destinationCity,
        destinationCountry: logisticsShipments.destinationCountry,
        carrierName: logisticsShipments.carrierName,
        awbNumber: logisticsShipments.awbNumber,
        blNumber: logisticsShipments.blNumber,
      },
      bond: logisticsMovementBonds,
    })
    .from(logisticsJobs)
    .innerJoin(logisticsShipments, eq(logisticsShipments.id, logisticsJobs.shipmentId))
    .leftJoin(logisticsMovementBonds, eq(logisticsMovementBonds.shipmentId, logisticsJobs.shipmentId))
    .where(eq(logisticsJobs.kind, 'export'))
    .orderBy(desc(logisticsJobs.createdAt))
    .limit(500);

  return {
    today,
    jobs: rows.map(({ job, shipment, bond }) => ({
      shipmentId: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      jobNumber: job.jobNumber,
      stage: job.stage,
      mode: exportModeOf(shipment.transportMode, job.bondedTransfer),
      clientName: job.clientName,
      origin: [shipment.originCity, shipment.originCountry].filter(Boolean).join(', '),
      destination: [shipment.destinationCity, shipment.destinationCountry].filter(Boolean).join(', '),
      carrierName: shipment.carrierName,
      reference: shipment.awbNumber ?? shipment.blNumber ?? null,
      invoiceNumber: job.invoiceNumber,
      invoiceValue: job.invoiceValue,
      invoiceCurrency: job.invoiceCurrency,
      createdAt: job.createdAt,
      bond: bond
        ? {
            amount: bond.bondAmount,
            currency: bond.currency,
            ...bondStatus(bond, today),
          }
        : null,
    })),
  };
});

export default adminGetExportJobs;
