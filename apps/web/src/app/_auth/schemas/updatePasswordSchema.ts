import { z } from 'zod';

import getPasswordStrength from '../uitls/passwordStrength';

const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .refine((password) => getPasswordStrength(password) >= 3, {
        message: 'Kies een sterk wachtwoord',
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Wachtwoorden komen niet overeen',
    path: ['confirmPassword'],
  });

export type UpdatePasswordSchema = z.infer<typeof updatePasswordSchema>;

export default updatePasswordSchema;
