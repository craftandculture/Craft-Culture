import { z } from 'zod';

/**
 * Schema for getting a single quote by ID
 *
 * @example
 *   { id: "uuid-here" }
 */
const getQuoteByIdSchema = z.object({
  id: z.string().uuid(),
});

export type GetQuoteByIdSchema = z.infer<typeof getQuoteByIdSchema>;

export default getQuoteByIdSchema;
