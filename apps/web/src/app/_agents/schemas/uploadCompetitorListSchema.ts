import { z } from 'zod';

/**
 * Schema for a single competitor wine row from an uploaded price list
 */
const competitorWineRowSchema = z.object({
  productName: z.string().min(1),
  vintage: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  bottleSize: z.string().optional(),
  sellingPriceAed: z.number().optional(),
  sellingPriceUsd: z.number().optional(),
  quantity: z.number().int().optional(),
});

/**
 * Schema for uploading a competitor wine price list
 */
const uploadCompetitorListSchema = z.object({
  competitorName: z.string().min(1),
  source: z.string().optional(),
  rows: z.array(competitorWineRowSchema).min(1),
});

export type CompetitorWineRow = z.infer<typeof competitorWineRowSchema>;

export default uploadCompetitorListSchema;
