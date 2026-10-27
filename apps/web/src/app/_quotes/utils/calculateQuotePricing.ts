import { getPricingConfig } from '@/app/_pricing/data/getPricingConfig';
import getRatesToUsd, { rateFor } from '@/app/_pricing/data/getRatesToUsd';
import db from '@/database/client';

export interface QuotePricingLineItem {
  productId: string;
  lineItemTotalUsd: number;
  commissionUsd: number;
  basePriceUsd: number;
}

export interface QuotePricing {
  lineItems: QuotePricingLineItem[];
  totalUsd: number;
  totalCommissionUsd: number;
  subtotalBeforeCommissionUsd: number;
}

interface PricingInputLine {
  offerId: string;
  quantity: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Price a quote from the live product offers and the B2B pricing config
 *
 * The single source of quote prices: the quote builder shows these figures and
 * save/update store them, so a saved quote can never carry a price or
 * commission the browser made up.
 *
 * @example
 *   const pricing = await calculateQuotePricing(
 *     [{ offerId, quantity: 2 }],
 *     'b2c',
 *   );
 *
 * @param lineItems - Offer ids and case quantities
 * @param customerType - B2c earns 5% commission per case; others none
 * @returns Per-line and total prices in USD
 */
const calculateQuotePricing = async (
  lineItems: PricingInputLine[],
  customerType: string | null | undefined,
): Promise<QuotePricing> => {
  const offerIds = [...new Set(lineItems.map((item) => item.offerId))];

  const [b2bConfig, offers] = await Promise.all([
    getPricingConfig('b2b'),
    offerIds.length > 0
      ? db.query.productOffers.findMany({
          where: { id: { in: offerIds } },
          columns: { id: true, productId: true, price: true, currency: true },
        })
      : Promise.resolve([]),
  ]);

  const ccMarginPercent = b2bConfig.cc_margin_percent ?? 0;
  const marginMultiplier = 1 / (1 - ccMarginPercent / 100);

  const rates = await getRatesToUsd(offers.map((offer) => offer.currency));

  const pricedLines: QuotePricingLineItem[] = lineItems.map((lineItem) => {
    const offer = offers.find((o) => o.id === lineItem.offerId);

    if (!offer) {
      return {
        productId: '',
        lineItemTotalUsd: 0,
        commissionUsd: 0,
        basePriceUsd: 0,
      };
    }

    const basePriceUsd = round2(
      offer.price * rateFor(rates, offer.currency) * marginMultiplier,
    );
    const lineItemTotalUsd = round2(basePriceUsd * lineItem.quantity);
    const commissionUsd =
      customerType === 'b2c'
        ? round2(basePriceUsd * 0.05 * lineItem.quantity)
        : 0;

    return {
      productId: offer.productId,
      lineItemTotalUsd,
      commissionUsd,
      basePriceUsd,
    };
  });

  const totalUsd = pricedLines.reduce(
    (sum, item) => sum + item.lineItemTotalUsd,
    0,
  );
  const totalCommissionUsd = pricedLines.reduce(
    (sum, item) => sum + item.commissionUsd,
    0,
  );

  return {
    lineItems: pricedLines,
    totalUsd: round2(totalUsd),
    totalCommissionUsd: round2(totalCommissionUsd),
    subtotalBeforeCommissionUsd: round2(totalUsd - totalCommissionUsd),
  };
};

export default calculateQuotePricing;
