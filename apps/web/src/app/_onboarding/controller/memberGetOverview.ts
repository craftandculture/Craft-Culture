import { and, eq, ne } from 'drizzle-orm';

import countChargeableCases from '@/app/_cellar/utils/countChargeableCases';
import monthlyMembershipCharge from '@/app/_cellar/utils/monthlyMembershipCharge';
import db from '@/database/client';
import {
  cellarIntakes,
  cellarMemberships,
  partnerIdentityDocuments,
  partners,
  wmsStock,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import getIntakeShipments from '../data/getIntakeShipments';
import getMembershipTerms from '../data/getMembershipTerms';
import laterIntakeStage from '../utils/laterIntakeStage';
import missingProfileItems from '../utils/missingProfileItems';

/**
 * The top of a member's cellar: what is missing, what this month costs, and
 * what is on its way in
 *
 * Cases are counted as held now. The month's charge uses the peak, which the
 * Storage screen works out when extra cases are pushed to billing.
 */
const memberGetOverview = stockOwnerProcedure.query(async ({ ctx }) => {
  const partnerId = ctx.partner.id;

  const [[partner], documents, stock, intakes, [membership], terms] = await Promise.all([
    db
      .select({
        phone: partners.businessPhone,
        deliveryAddress: partners.deliveryAddress,
        eidNumber: partners.eidNumber,
      })
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1),
    db
      .select({ documentType: partnerIdentityDocuments.documentType })
      .from(partnerIdentityDocuments)
      .where(eq(partnerIdentityDocuments.partnerId, partnerId)),
    db
      .select({
        lwin18: wmsStock.lwin18,
        quantityCases: wmsStock.quantityCases,
        openBottles: wmsStock.openBottles,
        bottleSize: wmsStock.bottleSize,
        caseConfig: wmsStock.caseConfig,
      })
      .from(wmsStock)
      .where(eq(wmsStock.ownerId, partnerId)),
    db
      .select()
      .from(cellarIntakes)
      .where(and(eq(cellarIntakes.partnerId, partnerId), ne(cellarIntakes.stage, 'closed'))),
    db.select().from(cellarMemberships).where(eq(cellarMemberships.partnerId, partnerId)).limit(1),
    getMembershipTerms(partnerId),
  ]);

  const cases = countChargeableCases(stock);
  // A summary of the cellar for the member: what they hold, not what it costs
  const bottles = stock.reduce(
    (sum, row) => sum + Math.max(0, row.quantityCases) * Math.max(1, row.caseConfig ?? 12) + Math.max(0, row.openBottles),
    0,
  );
  const wines = new Set(
    stock.filter((row) => row.quantityCases > 0 || row.openBottles > 0).map((row) => row.lwin18),
  ).size;
  const shown = intakes.filter((intake) => intake.source !== 'starting_fresh');
  const shipments = await getIntakeShipments(shown);

  return {
    missing: missingProfileItems({
      phone: partner?.phone ?? null,
      deliveryAddress: partner?.deliveryAddress ?? null,
      eidNumber: partner?.eidNumber ?? null,
      documentTypes: documents.map((document) => document.documentType),
    }),
    membershipStatus: membership?.status ?? 'not_activated',
    /** Card members fix a failed payment themselves; invoice members are paused by the team */
    billedByCard: Boolean(membership?.zohoSubscriptionId),
    nextBillingAt: membership?.nextBillingAt ?? null,
    terms,
    cases,
    bottles,
    wines,
    thisMonth: monthlyMembershipCharge(cases, terms),
    intakes: shown.map((intake) => {
      const shipment = shipments.get(intake.id);
      return {
        ...intake,
        stage: laterIntakeStage(intake.stage, shipment?.impliedStage ?? null),
        shipment: shipment
          ? {
              transportMode: shipment.transportMode,
              eta: shipment.eta,
              arrivedAt: shipment.arrivedAt,
              wines: shipment.wines,
              cases: shipment.memberCases,
            }
          : null,
      };
    }),
  };
});

export default memberGetOverview;
