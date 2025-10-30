import type { z } from 'zod';

import userActivityLogsGetMany from '@/app/_admin/data/userActivityLogsGetMany';
import type userActivityLogsGetManyInputSchema from '@/app/_admin/schemas/userActivityLogsGetManyInputSchema';

/**
 * Get user activity logs with pagination and filtering
 *
 * @param input - Query parameters for filtering and pagination
 * @returns Activity logs with user details and total count
 */
const userActivityLogsGetManyController = async (
  input: z.infer<typeof userActivityLogsGetManyInputSchema>,
): Promise<Awaited<ReturnType<typeof userActivityLogsGetMany>>> => {
  const result = await userActivityLogsGetMany(input);
  return result;
};

export default userActivityLogsGetManyController;
