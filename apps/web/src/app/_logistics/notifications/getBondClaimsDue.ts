import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import dubaiToday from '@/app/_teamTasks/utils/dubaiToday';
import db from '@/database/client';
import { logisticsJobs, logisticsMovementBonds, logisticsShipments } from '@/database/schema';

import { bondStatus } from '../utils/bondStatus';

/** Days before the claim deadline from which a bond is flagged on the board and in Slack */
export const BOND_ATTENTION_DAYS = 14;

/**
 * Bonded export jobs whose movement bond claim is due within 14 days, or missed
 *
 * Only bonds that have been paid, are not refunded and have no claim submitted
 * count: once the claim is in, the deadline no longer matters. Most urgent
 * first, with missed claims at the top.
 *
 * @param now - The moment to judge by
 * @returns Shipment-shaped rows with the bond's days left and deadline
 */
const getBondClaimsDue = async (now = new Date()) => {
  const today = dubaiToday(now);

  const rows = await db
    .select({
      id: logisticsShipments.id,
      shipmentNumber: logisticsShipments.shipmentNumber,
      name: logisticsShipments.name,
      type: logisticsShipments.type,
      status: logisticsShipments.status,
      originCity: logisticsShipments.originCity,
      destinationCity: logisticsShipments.destinationCity,
      eta: logisticsShipments.eta,
      jobNumber: logisticsJobs.jobNumber,
      bond: logisticsMovementBonds,
    })
    .from(logisticsMovementBonds)
    .innerJoin(logisticsJobs, eq(logisticsJobs.shipmentId, logisticsMovementBonds.shipmentId))
    .innerJoin(logisticsShipments, eq(logisticsShipments.id, logisticsMovementBonds.shipmentId))
    .where(
      and(
        eq(logisticsJobs.kind, 'export'),
        eq(logisticsJobs.bondedTransfer, true),
        isNotNull(logisticsMovementBonds.paidOn),
        isNull(logisticsMovementBonds.refundedOn),
        isNull(logisticsMovementBonds.claimSubmittedOn),
      ),
    );

  return rows
    .map(({ bond, ...shipment }) => {
      const status = bondStatus(bond, today);
      return { ...shipment, bondDaysLeft: status.daysLeft, bondDeadline: status.deadline };
    })
    .filter(
      (r): r is typeof r & { bondDaysLeft: number } =>
        r.bondDaysLeft !== null && r.bondDaysLeft <= BOND_ATTENTION_DAYS,
    )
    .sort((a, b) => a.bondDaysLeft - b.bondDaysLeft);
};

export default getBondClaimsDue;
