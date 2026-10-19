import resolveFxToUsd from '@/app/_logistics/utils/resolveFxToUsd';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import getUkRates from '../data/getUkRates';

/**
 * The UK rate card in force and its history, for Cellar rates
 *
 * @example
 *   const { current, history } = await trpcClient.cellar.admin.getUkRates.query();
 */
const adminGetUkRates = staffAdminProcedure.query(async () => {
  const [rates, gbp] = await Promise.all([getUkRates(), resolveFxToUsd('GBP')]);
  /* For pricing UK move quotes, which are written in dollars */
  return { ...rates, gbpToUsd: gbp.source === 'unresolved' ? null : gbp.rate };
});

export default adminGetUkRates;
