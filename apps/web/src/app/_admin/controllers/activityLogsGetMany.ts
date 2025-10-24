import type { z } from 'zod';

import activityLogsGetMany from '@/app/_admin/data/activityLogsGetMany';
import type activityLogsGetManyInputSchema from '@/app/_admin/schemas/activityLogsGetManyInputSchema';

/**
 * Get activity logs with pagination and filtering
 *
 * @param input - Query parameters for filtering and pagination
 * @returns Activity logs with admin details and total count
 */
const activityLogsGetManyController = async (
  input: z.infer<typeof activityLogsGetManyInputSchema>,
) => {
  const result = await activityLogsGetMany(input);
  return result;
};

export default activityLogsGetManyController;
