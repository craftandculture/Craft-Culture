import { z } from 'zod';

const updateUserSchema = z.object({
  name: z.string().min(2, 'Naam moet minimaal 2 karakters bevatten').optional(),
  customerType: z.enum(['b2b', 'b2c']).optional(),
  acceptTerms: z.boolean().optional(),
});

export type UpdateUserSchema = z.infer<typeof updateUserSchema>;

export default updateUserSchema;
