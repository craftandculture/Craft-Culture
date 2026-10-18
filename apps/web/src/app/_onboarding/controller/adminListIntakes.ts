import { desc, eq } from 'drizzle-orm';

import getClientCodes from '@/app/_cellar/data/getClientCodes';
import db from '@/database/client';
import { cellarIntakes, partners } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';


import getIntakeShipments from '../data/getIntakeShipments';
import laterIntakeStage from '../utils/laterIntakeStage';

/**
 * Every wine source members have told us about, newest first
 *
 * Intakes on an application that has not been approved yet have no member
 * cellar to land in and are listed under the applicant's name on
 * Applications instead. A transfer linked to a shipment carries it, with the
 * member's share of its cases, and shows the stage the shipment implies.
 */
const adminListIntakes = staffAdminProcedure.query(async () => {
  const rows = await db
    .select({ intake: cellarIntakes, memberName: partners.businessName, memberStatus: partners.status })
    .from(cellarIntakes)
    .innerJoin(partners, eq(partners.id, cellarIntakes.partnerId))
    .where(eq(partners.status, 'active'))
    .orderBy(desc(cellarIntakes.createdAt));

  const [shipments, codes] = await Promise.all([
    getIntakeShipments(rows.map(({ intake }) => intake)),
    getClientCodes([...new Set(rows.map(({ intake }) => intake.partnerId).filter((id): id is string => Boolean(id)))]),
  ]);

  return rows.map((row) => {
    const shipment = shipments.get(row.intake.id) ?? null;
    return {
      ...row,
      /** The reference the wine should arrive under at LCB */
      memberCode: (row.intake.partnerId && codes.get(row.intake.partnerId)) || null,
      intake: { ...row.intake, stage: laterIntakeStage(row.intake.stage, shipment?.impliedStage ?? null) },
      shipment,
    };
  });
});

export default adminListIntakes;
