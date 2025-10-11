import { z } from 'zod';

import isFreeDomain from '@/app/_administrations/data/isFreeDomain';

import getPasswordStrength from '../uitls/passwordStrength';

const signUpSchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase())
    .refine(
      async (v) => {
        const domain = v.split('@')[1];
        if (!domain) return false;
        const isFree = await isFreeDomain(`https://${domain}`);
        return !isFree;
      },
      {
        message:
          'Gebruik een zakelijk e-mailadres. Gratis domeinen zoals gmail.com en hotmail.com zijn niet toegestaan.',
      },
    ),
  password: z
    .string()
    .refine((password) => getPasswordStrength(password) >= 3, {
      message: 'Kies een sterk wachtwoord',
    }),
  name: z.string().min(2, 'Je naam moet minimaal 2 tekens bevatten'),
});

export type SignUpSchema = z.infer<typeof signUpSchema>;

export default signUpSchema;
