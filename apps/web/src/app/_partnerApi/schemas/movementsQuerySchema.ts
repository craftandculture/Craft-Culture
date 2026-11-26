import z from 'zod';

import movementCursor from '../utils/movementCursor';

/** An ISO-8601 date or date-time, as a Date */
const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be an ISO-8601 date or date-time')
  .transform((value) => new Date(value));

/**
 * Query parameters for `/account/movements` and `/account/sales`
 *
 * A cursor that does not decode is refused rather than ignored: ignoring it
 * would restart the export from the beginning, and an integration would
 * import its whole history a second time.
 */
const movementsQuerySchema = z.object({
  cursor: z
    .string()
    .refine((value) => movementCursor.decode(value) !== null, 'cursor is not one we issued')
    .optional(),
  since: isoDate.optional(),
  until: isoDate.optional(),
  lwin18: z
    .string()
    .regex(/^\d{7}-\d{4}-\d{2}-\d{5}$/, 'lwin18 must be dashed, e.g. 1010279-2015-06-00750')
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export default movementsQuerySchema;
