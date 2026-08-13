import { adminProcedure } from '@/lib/trpc/procedures';

import getLandedCostReport from '../data/getLandedCostReport';
import { landedCostReportSchema } from '../schemas/landedCostSchemas';


/**
 * Get landed cost analysis report
 *
 * Provides detailed cost breakdown per shipment and per product, with
 * aggregated summaries for analysis. The work lives in
 * `data/getLandedCostReport` so the Excel export can produce identical figures.
 */
const adminGetLandedCostReport = adminProcedure
  .input(landedCostReportSchema)
  .query(async ({ input }) => await getLandedCostReport(input));

export default adminGetLandedCostReport;
