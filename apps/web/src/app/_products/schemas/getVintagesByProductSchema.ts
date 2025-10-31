import { z } from 'zod';

/**
 * Schema for getting available vintage years for a product
 *
 * Returns all vintages available for products with the same name and producer
 *
 * @example
 *   {
 *     productId: "uuid-here"
 *   }
 */
const getVintagesByProductSchema = z.object({
  productId: z.string().uuid(),
});

export type GetVintagesByProductSchema = z.infer<
  typeof getVintagesByProductSchema
>;

export default getVintagesByProductSchema;
