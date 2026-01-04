import db from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * List all partner pricing overrides
 *
 * Returns all partners with bespoke PCO pricing configured,
 * including partner business name for display.
 */
const partnerOverridesList = adminProcedure.query(async () => {
  const overrides = await db.query.partnerPricingOverrides.findMany({
    with: {
      partner: true,
    },
    orderBy: (table, { asc }) => asc(table.createdAt),
  });

  return overrides.map((override) => ({
    id: override.id,
    partnerId: override.partnerId,
    partnerName: override.partner.businessName,
    partnerType: override.partner.type,
    ccMarginPercent: override.ccMarginPercent,
    importDutyPercent: override.importDutyPercent,
    transferCostPercent: override.transferCostPercent,
    distributorMarginPercent: override.distributorMarginPercent,
    vatPercent: override.vatPercent,
    effectiveFrom: override.effectiveFrom,
    effectiveUntil: override.effectiveUntil,
    notes: override.notes,
    createdAt: override.createdAt,
    updatedAt: override.updatedAt,
  }));
});

export default partnerOverridesList;
