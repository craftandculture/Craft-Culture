import z from 'zod';

/**
 * `?inStock=false` must read as false. z.coerce.boolean turns any non-empty
 * string, "false" included, into true.
 */
const queryBoolean = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

export const inventoryQuerySchema = z.object({
  cursor: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  source: z.enum(['local_inventory', 'cultx']).optional(),
  inStock: queryBoolean.optional(),
});

export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;

export interface InventoryItem {
  lwin18: string;
  name: string;
  producer: string | null;
  region: string | null;
  country: string | null;
  vintage: number | null;
  imageUrl: string | null;
  offers: {
    id: string;
    /** Withheld from partner-feed keys */
    source?: 'cultx' | 'local_inventory';
    /** Base offer price; withheld from partner-feed keys */
    price?: number;
    currency?: string;
    unitCount: number;
    unitSize: string;
    availableQuantity: number;
    inStock: boolean;
  }[];
}

export interface InventoryListResponse {
  data: InventoryItem[];
  meta: {
    nextCursor: number | null;
    totalCount: number;
  };
}
