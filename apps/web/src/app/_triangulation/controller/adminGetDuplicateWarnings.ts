import { adminProcedure } from '@/lib/trpc/procedures';

import findDuplicateLines from '../data/findDuplicateLines';
import { importIdSchema } from '../schemas/triangulationSchemas';

/**
 * Lines in an import that appear to restate stock already committed
 *
 * Read before committing, so a double-counted shipment is caught while it is
 * still a draft rather than discovered later as an unexplained variance.
 */
const adminGetDuplicateWarnings = adminProcedure
  .input(importIdSchema)
  .query(async ({ input }) => {
    const duplicates = await findDuplicateLines(input.importId);

    return {
      count: duplicates.length,
      bottles: duplicates.reduce((sum, line) => sum + line.quantityBottles, 0),
      lines: duplicates.slice(0, 50),
    };
  });

export default adminGetDuplicateWarnings;
