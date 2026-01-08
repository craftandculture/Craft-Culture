import { z } from 'zod';

const sendToPartnersSchema = z.object({
  rfqId: z.string().uuid(),
  partnerIds: z.array(z.string().uuid()).min(1, 'At least one partner is required'),
  contactIds: z.array(z.string().uuid()).optional(),
  responseDeadline: z.date().optional(),
});

export default sendToPartnersSchema;
