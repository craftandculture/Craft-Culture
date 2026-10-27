import { z } from 'zod';

/** Largest metadata payload (serialised JSON) a client may attach to one log row */
const MAX_METADATA_BYTES = 4000;

const activityLogCreateInputSchema = z.object({
  action: z.string().min(1).max(100),
  entityType: z.string().max(100).optional(),
  entityId: z.string().max(200).optional(),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .refine(
      (value) =>
        value === undefined || JSON.stringify(value).length <= MAX_METADATA_BYTES,
      { message: 'Activity metadata is too large' },
    ),
});

export default activityLogCreateInputSchema;
