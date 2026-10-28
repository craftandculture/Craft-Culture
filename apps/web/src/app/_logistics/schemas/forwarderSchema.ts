import { z } from 'zod';

const forwarderContactSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().optional(),
  role: z.string().trim().optional(),
});

/**
 * What a forwarder is kept with: its people, the modes it quotes and the
 * countries it collects from
 */
const forwarderSchema = z.object({
  name: z.string().trim().min(1, 'Name the forwarder'),
  contacts: z.array(forwarderContactSchema).max(20).default([]),
  modes: z.array(z.enum(['air', 'sea_fcl', 'sea_lcl', 'road'])).default([]),
  originCountries: z.array(z.string().trim().min(1)).max(60).default([]),
  notes: z.string().trim().optional(),
});

export default forwarderSchema;
