import { z } from 'zod';

/** One tier: the margin to take on a wine whose landed cost falls in its range. */
export const pricingBandSchema = z
  .object({
    id: z.string().uuid().optional(),
    /** Null = the house band, used for every owner without one of their own. */
    ownerId: z.string().uuid().nullable().default(null),
    minLandedPerBottle: z.number().min(0),
    /** Null = no upper limit. */
    maxLandedPerBottle: z.number().positive().nullable(),
    b2bMarginPct: z.number().min(0).lt(100),
    pcMarginPct: z.number().min(0).lt(100),
  })
  .refine(
    (band) =>
      band.maxLandedPerBottle == null ||
      band.maxLandedPerBottle > band.minLandedPerBottle,
    { message: 'The top of a band must be above its bottom', path: ['maxLandedPerBottle'] },
  );

export const setPricingBandsSchema = z.object({
  /** Whose bands these are; null replaces the house bands. */
  ownerId: z.string().uuid().nullable().default(null),
  /** The complete set for that owner — anything omitted is removed. */
  bands: z.array(pricingBandSchema).max(12),
});

export const getPricingBandsSchema = z
  .object({ ownerId: z.string().uuid().nullable().optional() })
  .optional();

export type PricingBandInput = z.infer<typeof pricingBandSchema>;
