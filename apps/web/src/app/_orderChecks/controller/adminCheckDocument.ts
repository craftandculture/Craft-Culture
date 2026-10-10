import { z } from 'zod';

import { PEGGED } from '@/app/_logistics/utils/resolveFxToUsd';
import { adminProcedure } from '@/lib/trpc/procedures';

import fetchCheckDocument from '../data/fetchCheckDocument';
import loadCheckContext from '../data/loadCheckContext';
import checkOrderLines from '../utils/checkOrderLines';

/**
 * Check one sales order, invoice or PCO before it goes to the client
 *
 * @example
 *   await trpcClient.orderChecks.check.query({ number: 'SO-00140' });
 */
const adminCheckDocument = adminProcedure
  .input(z.object({ number: z.string().trim().min(2).max(40) }))
  .query(async ({ input }) => {
    const [doc, context] = await Promise.all([fetchCheckDocument(input.number), loadCheckContext()]);

    const result = checkOrderLines(doc.lines, {
      ...context,
      currency: doc.currency,
      toUsd: PEGGED[doc.currency] ?? null,
      // A PCO line holds C&C's cost, not the price the client is billed
      comparePrices: doc.kind !== 'pco',
    });

    return { document: { ...doc, lines: undefined }, ...result };
  });

export default adminCheckDocument;
