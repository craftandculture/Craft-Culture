import { z } from 'zod';

/**
 * Schema for admin changing a user's email address
 */
const adminChangeEmailSchema = z.object({
  userId: z.string().uuid(),
  newEmail: z.string().email('Please enter a valid email address'),
});

export type AdminChangeEmailSchema = z.infer<typeof adminChangeEmailSchema>;

export default adminChangeEmailSchema;
