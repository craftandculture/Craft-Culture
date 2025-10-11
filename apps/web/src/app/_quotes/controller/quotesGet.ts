import { calculateQuote } from '@/app/_pricingModels/utils/calculateQuote';
import db from '@/database/client';
import { protectedProcedure } from '@/lib/trpc/procedures';

import getQuoteRequestSchema from '../schemas/getQuoteRequestSchema';

const quotesGet = protectedProcedure
  .input(getQuoteRequestSchema)
  .query(async ({ input: { lineItems }, ctx: { user } }) => {
    // Get the user's pricing model, or use the default based on their customer type
    let pricingModel;

    if (user.pricingModelId) {
      // User has a specific pricing model assigned
      pricingModel = await db.query.pricingModels.findFirst({
        where: {
          id: user.pricingModelId,
        },
        with: {
          sheet: true,
        },
      });
    } else {
      // Use default pricing model based on customer type
      const isB2C = user.customerType === 'b2c';
      pricingModel = await db.query.pricingModels.findFirst({
        where: isB2C ? { isDefaultB2C: true } : { isDefaultB2B: true },
        with: {
          sheet: true,
        },
      });
    }

    if (!pricingModel) {
      throw new Error('No pricing model found');
    }

    // Fetch all the offers for the line items
    const offerIds = lineItems.map((item) => item.offerId);
    const offers = await db.query.productOffers.findMany({
      where: {
        id: {
          in: offerIds,
        },
      },
      with: {
        product: true,
      },
    });

    // Calculate quote using the pricing model
    const quoteData = await calculateQuote(
      lineItems,
      offers,
      pricingModel.cellMappings,
      pricingModel.sheet.formulaData as Record<string, unknown>,
      user.customerType,
    );

    return quoteData;
  });

export default quotesGet;
