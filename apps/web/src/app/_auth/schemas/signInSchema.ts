import { z } from 'zod';

const signInSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
});

export default signInSchema;

export type SignInSchema = z.infer<typeof signInSchema>;
