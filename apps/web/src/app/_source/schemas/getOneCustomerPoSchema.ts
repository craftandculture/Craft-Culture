import { z } from 'zod';

const getOneCustomerPoSchema = z.object({
  id: z.string().uuid(),
});

export default getOneCustomerPoSchema;
