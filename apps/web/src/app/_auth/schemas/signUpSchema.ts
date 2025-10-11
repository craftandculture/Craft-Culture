import { z } from 'zod';

import getPasswordStrength from '../uitls/passwordStrength';

const signUpSchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .refine((password) => getPasswordStrength(password) >= 3, {
      message: 'Kies een sterk wachtwoord',
    }),
  name: z.string().min(2, 'Je naam moet minimaal 2 tekens bevatten'),
});

export type SignUpSchema = z.infer<typeof signUpSchema>;

export default signUpSchema;
