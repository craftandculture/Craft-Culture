import { z } from 'zod';

/** Input for reading a client's purchase order into a preview. */
const previewLpoSchema = z.object({
  file: z.string().describe('Base64 encoded PDF or spreadsheet data URL'),
  fileName: z.string().optional(),
  /**
   * Only rows from one consignor, where the file is a replenishment sheet.
   *
   * "the OpenCellar lines" is a real instruction: one sheet carries several
   * consignors and an order is placed with one of them.
   */
  source: z.string().optional(),
  /**
   * The vintage a line means, where its order never said.
   *
   * Keyed by the line's position in the order. Some purchase orders name the
   * wine and the pack and stop there; the same wine across two years is two
   * products at two prices, so the year is asked rather than assumed. Sending
   * the answer back re-reads the order with it, which keeps stock, repacks,
   * customs and price derived in one place instead of two.
   */
  vintages: z.record(z.string(), z.string()).optional(),
});

export default previewLpoSchema;
