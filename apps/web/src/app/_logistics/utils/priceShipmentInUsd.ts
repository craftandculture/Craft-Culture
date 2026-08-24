import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';

import resolveFxToUsd from './resolveFxToUsd';

export interface PriceShipmentOptions {
  /** The rate actually agreed with the supplier, if there is one */
  agreedRate?: number;
  /** Overrides the currency read off the document */
  currency?: string;
}

/**
 * Price a shipment's goods in USD at one rate
 *
 * A supplier invoice settles at a single rate, so it converts at a single rate.
 * Doing it per line is what turned a 165-line invoice into 165 manual sums.
 *
 * The conversion always works from the amounts the document stated, never from
 * the last USD figure, so re-running with a better rate corrects rather than
 * compounds. The rate, its source and its date are written to the shipment,
 * because a landed cost nobody can explain six months later is a number nobody
 * can defend.
 *
 * @param shipmentId - The shipment to price
 * @param options - An agreed rate and/or an explicit currency
 * @returns The rate used, where it came from, and how many lines it priced
 */
const priceShipmentInUsd = async (
  shipmentId: string,
  options: PriceShipmentOptions = {},
) => {
  const [shipment] = await db
    .select({ sourceCurrency: logisticsShipments.sourceCurrency })
    .from(logisticsShipments)
    .where(eq(logisticsShipments.id, shipmentId))
    .limit(1);

  // The items carry whatever the supplier billed in, so they are the fallback
  // when the shipment itself has not been stamped yet.
  const [sample] = await db
    .select({ currency: logisticsShipmentItems.sourceCurrency })
    .from(logisticsShipmentItems)
    .where(eq(logisticsShipmentItems.shipmentId, shipmentId))
    .limit(1);

  const currency = (
    options.currency ??
    shipment?.sourceCurrency ??
    sample?.currency ??
    'USD'
  ).toUpperCase();

  const resolved = options.agreedRate
    ? { rate: options.agreedRate, source: 'agreed' as const }
    : await resolveFxToUsd(currency);

  if (resolved.source === 'unresolved') {
    return {
      currency,
      rate: null,
      rateSource: 'unresolved' as const,
      rateDate: null,
      itemsPriced: 0,
    };
  }

  const today = new Date().toISOString().slice(0, 10);

  await db
    .update(logisticsShipments)
    .set({
      sourceCurrency: currency,
      fxRateToUsd: resolved.rate,
      fxRateDate: today,
      fxRateSource: resolved.source,
    })
    .where(eq(logisticsShipments.id, shipmentId));

  const updated = await db
    .update(logisticsShipmentItems)
    .set({
      productCostPerBottle: sql`ROUND((${logisticsShipmentItems.sourceUnitPrice} * ${resolved.rate})::numeric, 4)`,
      declaredValueUsd: sql`ROUND((${logisticsShipmentItems.sourceTotal} * ${resolved.rate})::numeric, 2)`,
    })
    .where(
      sql`${logisticsShipmentItems.shipmentId} = ${shipmentId}
          AND ${logisticsShipmentItems.sourceUnitPrice} IS NOT NULL`,
    )
    .returning({ id: logisticsShipmentItems.id });

  return {
    currency,
    rate: resolved.rate,
    rateSource: resolved.source,
    rateDate: today,
    itemsPriced: updated.length,
  };
};

export default priceShipmentInUsd;
