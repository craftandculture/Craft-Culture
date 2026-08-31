import { z } from 'zod';

/** Input for reading a client's purchase order into a preview. */
const previewLpoSchema = z.object({
  file: z.string().describe('Base64 encoded PDF data URL'),
  fileName: z.string().optional(),
});

export default previewLpoSchema;
