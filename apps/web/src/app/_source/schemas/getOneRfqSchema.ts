import { z } from 'zod';

const getOneRfqSchema = z.object({
  rfqId: z.string().uuid(),
});

export default getOneRfqSchema;
