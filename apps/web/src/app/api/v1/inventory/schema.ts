import z from 'zod';

export const inventoryQuerySchema = z.object({
  cursor: z.coerce.number().optional().default(0),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  source: z.enum(['local_inventory', 'cultx']).optional(),
  inStock: z.coerce.boolean().optional(),
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
    source: 'cultx' | 'local_inventory';
    price: number;
    currency: string;
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
