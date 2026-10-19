import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import getHiddenLabelOwners from '../data/getHiddenLabelOwners';

/**
 * Owners whose names must not print on labels, with their references
 *
 * Read by every screen that prints a label in the browser, so the label rule
 * is applied the same way there as on the server.
 */
const adminGetHiddenLabelOwners = wmsOperatorProcedure.query(async () =>
  getHiddenLabelOwners(),
);

export default adminGetHiddenLabelOwners;
