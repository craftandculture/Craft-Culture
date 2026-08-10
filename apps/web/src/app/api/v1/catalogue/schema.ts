import z from 'zod';

export const catalogueQuerySchema = z.object({
  feed: z.enum(['trade', 'retail', 'both']).optional().default('both'),
  category: z.enum(['Wine', 'Spirits', 'RTD']).optional(),
  ownerId: z.string().uuid().optional(),
  search: z.string().optional(),
  /**
   * 'available' (default) = landed stock in the UAE warehouse. 'inbound' =
   * bought and in transit, not yet received — carries an eta.
   */
  stock: z.enum(['available', 'inbound']).optional().default('available'),
});

export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;

export interface CatalogueResponseItem {
  lwin18: string;
  product: string;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  country: string | null;
  category: string | null;
  owner: string | null;
  format: string;
  caseConfig: number;
  bottleSize: string | null;
  availableCases: number;
  availableBottles: number;
  /** Price for the requested feed (IB for trade, PC for retail) */
  pricePerBottle: number;
  pricePerCase: number;
  /** In-Bond B2B (trade) price */
  ib: { perBottle: number; perCase: number };
  /** Private-Client (retail) price */
  pc: { perBottle: number; perCase: number };
  /** Estimated arrival, ISO date — inbound stock only, null otherwise */
  eta?: string | null;
}

export interface CatalogueResponse {
  data: CatalogueResponseItem[];
  meta: { feed: string; stock: string; totalCount: number };
}
