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
});

export default previewLpoSchema;
