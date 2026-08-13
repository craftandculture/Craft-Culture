import { z } from 'zod';

/** Filters for the landed cost report. */
export const landedCostReportSchema = z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  partnerId: z.string().uuid().optional(),
  transportMode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road']).optional(),
});

export type LandedCostReportInput = z.infer<typeof landedCostReportSchema>;
