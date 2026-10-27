import { approvedProcedure } from '@/lib/trpc/procedures';

import getQuoteRequestSchema from '../schemas/getQuoteRequestSchema';
import calculateQuotePricing from '../utils/calculateQuotePricing';

const quotesGet = approvedProcedure
  .input(getQuoteRequestSchema)
  .query(async ({ input: { lineItems }, ctx: { user } }) =>
    calculateQuotePricing(lineItems, user.customerType),
  );

export default quotesGet;
