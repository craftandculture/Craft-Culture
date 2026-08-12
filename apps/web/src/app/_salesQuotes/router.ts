import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminDeleteSalesQuote from './controller/adminDeleteSalesQuote';
import adminGetSalesQuote from './controller/adminGetSalesQuote';
import adminGetSalesQuotes from './controller/adminGetSalesQuotes';
import adminGetSelectableLines from './controller/adminGetSelectableLines';
import adminSaveSalesQuote from './controller/adminSaveSalesQuote';
import adminSetSalesQuoteStatus from './controller/adminSetSalesQuoteStatus';

/**
 * Sales quotes router
 *
 * Team-built, client-facing offer pages rendered with the standard branded
 * template and served publicly at /q/<slug>.
 *
 * Distinct from the `quotes` router, which drives the partner buy-request
 * workflow (buy request → C&C review → PO → payment) and outputs a PDF. These
 * are outbound sales offers: selectable lines, template options, one link.
 *
 * Every procedure is admin-only — quotes expose cost-derived pricing.
 */
const salesQuotesRouter = createTRPCRouter({
  admin: createTRPCRouter({
    selectableLines: adminGetSelectableLines,
    getMany: adminGetSalesQuotes,
    getOne: adminGetSalesQuote,
    save: adminSaveSalesQuote,
    setStatus: adminSetSalesQuoteStatus,
    delete: adminDeleteSalesQuote,
  }),
});

export default salesQuotesRouter;
