import { z } from 'zod';

export const getContactsSchema = z.object({
  partnerId: z.string().uuid(),
});

export const createContactSchema = z.object({
  partnerId: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  role: z.string().optional(),
  phone: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export const updateContactSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
  role: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
});

export const deleteContactSchema = z.object({
  id: z.string().uuid(),
});
