import { z } from 'zod';
import z4 from 'zod/v4';

const updateUserSchema = z.object({
  name: z.string().min(2, 'Naam moet minimaal 2 karakters bevatten').optional(),
  phone: z
    .string()
    .refine(
      (phone) => z4.e164().safeParse(phone).success,
      'Telefoonnummer is niet geldig',
    )
    .optional(),
  roleAtOrganization: z
    .enum(['accountant', 'director', 'freelancer', 'other'])
    .optional(),
  referralSource: z.string().optional(),
});

export type UpdateUserSchema = z.infer<typeof updateUserSchema>;

export default updateUserSchema;
