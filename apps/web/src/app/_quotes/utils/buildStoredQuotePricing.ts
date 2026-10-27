import convertUsdToAed from '@/utils/convertUsdToAed';

import calculateQuotePricing from './calculateQuotePricing';
import type { QuoteExtras } from '../schemas/quoteExtrasSchema';

interface BuildStoredQuotePricingParams {
  lineItems: { offerId: string; quantity: number }[];
  extras: QuoteExtras;
  currency: 'USD' | 'AED';
  customerType: string | null | undefined;
  /** Keys of the stored quote data to carry over (e.g. admin-added items) */
  existingQuoteData?: Record<string, unknown> | null;
}

/** Stored-data keys only the server or C&C staff may set */
const SERVER_OWNED_KEYS = [
  'lineItems',
  'totalUsd',
  'totalCommissionUsd',
  'subtotalBeforeCommissionUsd',
] as const;

/**
 * Build the quote_data, total_usd and total_aed a quote is stored with
 *
 * Prices come from calculateQuotePricing; only the customer's own extras (B2B
 * markup settings, out-of-catalogue requests) are taken from the browser.
 *
 * @example
 *   const { quoteData, totalUsd, totalAed } = await buildStoredQuotePricing({
 *     lineItems,
 *     extras: input.quoteData,
 *     currency: 'AED',
 *     customerType: 'b2c',
 *   });
 */
const buildStoredQuotePricing = async ({
  lineItems,
  extras,
  currency,
  customerType,
  existingQuoteData,
}: BuildStoredQuotePricingParams) => {
  const pricing = await calculateQuotePricing(lineItems, customerType);

  const carried: Record<string, unknown> = { ...(existingQuoteData ?? {}) };

  for (const key of SERVER_OWNED_KEYS) delete carried[key];

  const quoteData: Record<string, unknown> = {
    ...carried,
    ...pricing,
  };

  if (customerType === 'b2b' && extras?.marginConfig) {
    quoteData.marginConfig = extras.marginConfig;

    if (extras.customerQuotePrice !== undefined) {
      quoteData.customerQuotePrice = extras.customerQuotePrice;
    }
  }

  if (extras?.outOfCatalogueRequests) {
    const valid = extras.outOfCatalogueRequests.filter(
      (item) => item.productName.trim() !== '',
    );

    if (valid.length > 0) quoteData.outOfCatalogueRequests = valid;
  }

  const totalAed =
    currency === 'AED'
      ? Math.round(convertUsdToAed(pricing.totalUsd) * 100) / 100
      : undefined;

  return { quoteData, totalUsd: pricing.totalUsd, totalAed, pricing };
};

export default buildStoredQuotePricing;
