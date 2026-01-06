import { z } from 'zod';

const deleteItemSchema = z.object({
  itemId: z.string().uuid(),
});

export default deleteItemSchema;
