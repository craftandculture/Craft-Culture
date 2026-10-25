import { and, eq, ne } from 'drizzle-orm';

import ensureClientCode from '@/app/_cellar/data/ensureClientCode';
import countChargeableCases from '@/app/_cellar/utils/countChargeableCases';
import db from '@/database/client';
import {
  cellarIntakes,
  cellarMemberships,
  cellarUkHoldings,
  cellarUkRotations,
  partnerIdentityDocuments,
  partners,
  wmsStock,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import getIntakeShipments from '../data/getIntakeShipments';
import getMembershipTerms from '../data/getMembershipTerms';
import intakeRouteOf from '../utils/intakeRouteOf';
import isUnconfirmedIntake from '../utils/isUnconfirmedIntake';
import laterIntakeStage from '../utils/laterIntakeStage';
import missingProfileItems from '../utils/missingProfileItems';

/**
 * The top of a member's cellar: what is missing, what they hold, and what is
 * on its way in
 *
 * Cases are counted as held now. No fee, rate or monthly total is sent: a
 * member never sees what they spend, and what is not in the response cannot
 * leak into a screen later. Only the allowance goes, as room to grow into.
 */
const memberGetOverview = stockOwnerProcedure.query(async ({ ctx }) => {
  const partnerId = ctx.partner.id;

  const [[partner], documents, stock, intakes, [membership], terms, reference] = await Promise.all([
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
    ensureClientCode(partnerId),
  ]);

  const cases = countChargeableCases(stock);

  /*
    Wine at our UK bond, counted by the same rule, so a member whose wine is
    all in London is not told they store nothing. It is held under the UK
    rates, not the membership allowance, so it is a figure of its own.
  */
  let ukCases = 0;
  try {
    const ukLines = await db
      .select({
        cases: cellarUkHoldings.cases,
        singles: cellarUkHoldings.singles,
        bottlesPerCase: cellarUkHoldings.bottlesPerCase,
        bottleSizeLitres: cellarUkHoldings.bottleSizeLitres,
      })
      .from(cellarUkHoldings)
      .innerJoin(cellarUkRotations, eq(cellarUkHoldings.rotation, cellarUkRotations.rotation))
      .where(eq(cellarUkRotations.partnerId, partnerId));
    ukCases = countChargeableCases(
      ukLines.map((line) => ({
        quantityCases: line.cases,
        openBottles: line.singles,
        caseConfig: line.bottlesPerCase,
        bottleSize: line.bottleSizeLitres ? `${Math.round(line.bottleSizeLitres * 100)}cl` : '75cl',
      })),
    );
  } catch (error) {
    logger.error('Could not count a member’s UK cases', { partnerId, error });
  }
  // A summary of the cellar for the member: what they hold, not what it costs
  const bottles = stock.reduce(
    (sum, row) => sum + Math.max(0, row.quantityCases) * Math.max(1, row.caseConfig ?? 12) + Math.max(0, row.openBottles),
    0,
  );
  const wines = new Set(
    stock.filter((row) => row.quantityCases > 0 || row.openBottles > 0).map((row) => row.lwin18),
  ).size;
  const shown = intakes.filter(
    (intake) => intake.source !== 'starting_fresh' && !isUnconfirmedIntake(intake),
  );
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
    /** Cases included in the membership, and nothing about price */
    includedCases: terms.includedCases,
    /** Quoted on wine sent to our UK bond, so it is recognised as theirs */
    reference,
    cases,
    /** Case units at our UK bond, outside the allowance */
    ukCases,
    bottles,
    wines,
    intakes: shown.map((intake) => {
      const shipment = shipments.get(intake.id);
      return {
        ...intake,
        route: intakeRouteOf(intake),
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
