import { adminProcedure } from '@/lib/trpc/procedures';

import isStaff from './isStaff';

/**
 * An admin procedure narrowed to C&C staff
 *
 * Kept beside the daily sales view rather than in the shared procedures, since
 * this is the only place that needs it. See `isStaff` for why admin alone is
 * not enough.
 */
const staffProcedure = adminProcedure.use(async ({ ctx, next }) => {
  ctx.accessControl(() => isStaff(ctx.user));

  return await next({ ctx });
});

export default staffProcedure;
