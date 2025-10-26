import { z } from 'zod';

/**
 * Input schema for updating a setting
 *
 * @example
 *   { key: 'leadTimeMin', value: '14' }
 */
const settingsUpdateInputSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export default settingsUpdateInputSchema;
