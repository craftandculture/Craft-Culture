import { z } from 'zod';

/**
 * Bank details nested object schema
 */
const bankDetailsSchema = z
  .object({
    bankName: z.string().max(100).optional(),
    accountName: z.string().max(100).optional(),
    accountNumber: z.string().max(50).optional(),
    sortCode: z.string().max(20).optional(),
    iban: z.string().max(50).optional(),
    swiftBic: z.string().max(20).optional(),
    branchAddress: z.string().max(200).optional(),
  })
  .optional();

/**
 * Schema for updating personal details (B2C users for commission payouts)
 */
const updatePersonalDetailsSchema = z.object({
  // Personal address
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  stateProvince: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  // Bank details for commission payouts
  bankDetails: bankDetailsSchema,
});

export default updatePersonalDetailsSchema;
