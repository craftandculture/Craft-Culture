import z from 'zod';

/**
 * Schema for marking a quote as delivered
 */
const markAsDeliveredSchema = z.object({
  quoteId: z.string().uuid(),
});

export type MarkAsDeliveredInput = z.infer<typeof markAsDeliveredSchema>;

export default markAsDeliveredSchema;
