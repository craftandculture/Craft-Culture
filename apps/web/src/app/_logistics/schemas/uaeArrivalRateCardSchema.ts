import { z } from 'zod';

/**
 * The standard charges to land a shipment in the UAE, in AED
 *
 * `covers` says which part of a forwarder's quote already pays for the charge,
 * so a quote that includes destination customs is not charged it twice.
 * `modes` limits a charge to air or sea (airport handling is air only).
 * `variables` are charges that apply only sometimes (a certificate of origin
 * that cannot be found): shown beside the price as a caveat, never added.
 */
const uaeArrivalRateCardSchema = z.object({
  lines: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        amountAed: z.number().min(0),
        covers: z.enum(['customs', 'handling']),
        modes: z.enum(['all', 'air', 'sea']),
      }),
    )
    .max(40),
  variables: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        amountAed: z.number().min(0),
        per: z.string().trim().min(1),
      }),
    )
    .max(20)
    .default([]),
});

export type UaeArrivalRateCard = z.infer<typeof uaeArrivalRateCardSchema>;

export default uaeArrivalRateCardSchema;
