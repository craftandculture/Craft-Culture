import type { User } from '@/database/schema';

/**
 * User context type returned from auth functions
 */
export type UserContext = User & {
  firstName: string | null;
  lastName: string | null;
};
