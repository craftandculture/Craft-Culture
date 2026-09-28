import { z } from 'zod';

import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import buildClonePreview from '../utils/buildClonePreview';

/**
 * What cloning any partner's order would need, before it is cloned (C&C)
 */
const adminClonePreview = wmsOperatorProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      copies: z.number().int().min(0).max(60),
    }),
  )
  .query(({ input }) => buildClonePreview(input.orderId, input.copies));

export default adminClonePreview;
