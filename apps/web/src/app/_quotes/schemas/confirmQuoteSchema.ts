import { z } from 'zod';

/**
 * Schema for payment details (bank transfer or payment link)
 */
const paymentDetailsSchema = z.object({
  // Bank transfer details
  bankName: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  sortCode: z.string().optional(),
  iban: z.string().optional(),
  swiftBic: z.string().optional(),
  reference: z.string().optional(),
  // Payment link
  paymentUrl: z.string().url().optional(),
});

/**
 * Schema for C&C confirming a quote
 *
 * Payment fields (licensedPartnerId, paymentMethod, paymentDetails) are
 * required for B2C users but optional for B2B users who use the PO flow.
 */
const confirmQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  deliveryLeadTime: z.string().min(1, 'Delivery lead time is required'),
  ccConfirmationNotes: z.string().optional(),
  // Licensed partner and payment - required for B2C, optional for B2B
  licensedPartnerId: z.string().uuid().optional(),
  paymentMethod: z.enum(['bank_transfer', 'link']).optional(),
  paymentDetails: paymentDetailsSchema.optional(),
  lineItemAdjustments: z
    .record(
      z.string(),
      z.object({
        adjustedPricePerCase: z.number().optional(),
        confirmedQuantity: z.number().optional(),
        available: z.boolean(),
        notes: z.string().optional(),
        adminAlternatives: z
          .array(
            z.object({
              productName: z.string(),
              pricePerCase: z.number(),
              bottlesPerCase: z.number(),
              bottleSize: z.string(),
              quantityAvailable: z.number(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

export default confirmQuoteSchema;
