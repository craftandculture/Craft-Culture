import { z } from 'zod';

/**
 * Schema for creating a new pricing session
 */
const createSessionSchema = z.object({
  name: z.string().min(1, 'Session name is required'),
  sourceType: z.enum(['upload', 'google_sheet']),
  sourceFileName: z.string().optional(),
  googleSheetId: z.string().optional(),
  rawData: z.array(z.record(z.string(), z.unknown())).optional(),
  detectedColumns: z.array(z.string()).optional(),
  columnMapping: z.record(z.string(), z.string()).optional(),
});

export default createSessionSchema;
