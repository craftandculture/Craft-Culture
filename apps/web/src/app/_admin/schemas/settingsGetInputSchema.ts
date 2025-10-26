import { z } from 'zod';

/**
 * Input schema for getting a setting by key
 *
 * @example
 *   { key: 'leadTimeMin' }
 */
const settingsGetInputSchema = z.object({
  key: z.string().min(1),
});

export default settingsGetInputSchema;
