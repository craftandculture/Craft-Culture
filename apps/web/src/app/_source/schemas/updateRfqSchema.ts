import { z } from 'zod';

const updateRfqSchema = z.object({
  rfqId: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  distributorName: z.string().optional(),
  distributorEmail: z.string().email().optional().or(z.literal('')),
  distributorCompany: z.string().optional(),
  distributorNotes: z.string().optional(),
  responseDeadline: z.date().optional(),
});

export default updateRfqSchema;
