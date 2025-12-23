import z from 'zod';

/**
 * Schema for marking a B2C quote as paid
 */
const markAsPaidSchema = z.object({
  quoteId: z.string().uuid(),
});

export type MarkAsPaidInput = z.infer<typeof markAsPaidSchema>;

export default markAsPaidSchema;
