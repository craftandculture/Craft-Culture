import { z } from 'zod';

const resetPasswordSchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
});

export default resetPasswordSchema;

export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
