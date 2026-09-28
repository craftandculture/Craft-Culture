import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import cloneOrderSchema from '../schemas/cloneOrderSchema';
import cloneOrderForClients from '../utils/cloneOrderForClients';

/**
 * Clone any partner's order for a list of that partner's clients (C&C)
 */
const adminCloneOrder = wmsOperatorProcedure
  .input(cloneOrderSchema)
  .mutation(({ input }) => cloneOrderForClients(input));

export default adminCloneOrder;
