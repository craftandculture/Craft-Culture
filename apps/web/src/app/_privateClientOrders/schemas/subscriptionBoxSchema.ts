import { z } from 'zod';

import { SUBSCRIPTION_CASE_SIZES, SUBSCRIPTION_TIERS } from '../constants';

const tierValues = SUBSCRIPTION_TIERS.map((t) => t.value) as [string, ...string[]];

/**
 * Input for tagging an order as a subscription box; `box: null` clears it
 *
 * Tier and case size are required together; the variant is optional.
 */
const subscriptionBoxSchema = z.object({
  orderId: z.string().uuid(),
  box: z
    .object({
      tier: z.enum(tierValues),
      caseSize: z
        .number()
        .int()
        .refine((n) => (SUBSCRIPTION_CASE_SIZES as readonly number[]).includes(n), {
          message: 'Case size must be 3 or 6',
        }),
      variant: z.string().trim().max(60).optional(),
    })
    .nullable(),
});

export default subscriptionBoxSchema;
