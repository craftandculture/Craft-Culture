import type { z } from 'zod';

import userActivityLogsGetMany from '@/app/_admin/data/userActivityLogsGetMany';
import type userActivityLogsGetManyInputSchema from '@/app/_admin/schemas/userActivityLogsGetManyInputSchema';

interface UserActivityLog {
  id: string;
  userId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    customerType: string;
  } | null;
}

interface UserActivityLogsResult {
  logs: UserActivityLog[];
  total: number;
}

/**
 * Get user activity logs with pagination and filtering
 *
 * @param input - Query parameters for filtering and pagination
 * @returns Activity logs with user details and total count
 */
const userActivityLogsGetManyController = async (
  input: z.infer<typeof userActivityLogsGetManyInputSchema>,
): Promise<UserActivityLogsResult> => {
  const result = await userActivityLogsGetMany(input);
  return result;
};

export default userActivityLogsGetManyController;
