import z from 'zod';

const createApiKeySchema = z.object({
  partnerId: z.string().uuid(),
  name: z.string().min(1, 'API key name is required'),
  permissions: z.array(z.string()).default(['read:inventory']),
  expiresAt: z.date().optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export default createApiKeySchema;
