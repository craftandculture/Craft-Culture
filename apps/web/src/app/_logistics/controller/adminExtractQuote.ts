import { createAnthropic } from '@ai-sdk/anthropic';
import { TRPCError } from '@trpc/server';
import { generateObject } from 'ai';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsForwarders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import forwarderEmailDomain from '../utils/forwarderEmailDomain';

/** The line categories the quote form offers */
const CATEGORIES = [
  'Freight',
  'Origin Handling',
  'Destination Handling',
  'Documentation',
  'Insurance',
  'Customs',
  'Local Delivery',
  'Other',
] as const;

const extractedSchema = z.object({
  forwarderName: z.string().describe('The company that issued the quote (the forwarder), not the customer'),
  forwarderEmail: z.string().optional().describe('Email address of the person at the forwarder who sent or signed it'),
  contactName: z.string().optional().describe('Name of that person'),
  forwarderReference: z
    .string()
    .optional()
    .describe("The forwarder's own quote or reference number, exactly as printed"),
  currency: z.string().describe('3-letter ISO 4217 code of the amounts (GBP, EUR, USD, AED...)'),
  lineItems: z
    .array(
      z.object({
        category: z
          .enum(CATEGORIES)
          .describe(
            'Freight = air/sea/road freight and fuel or security surcharges on it; Origin Handling = collection, pallets, export handling; Documentation = export docs, EAD/T1, certificates; Customs = clearance; Destination Handling = arrival handling; Local Delivery = delivery to the warehouse; Insurance = cargo insurance',
          ),
        description: z.string(),
        total: z.number().describe('The amount for this line, a number only'),
      }),
    )
    .describe('Every priced line, in the order printed; leave out lines with no price'),
  totalPrice: z.number().describe('The quote total as printed; if none is printed, the sum of the lines'),
  transitDays: z.number().int().optional().describe('Transit time in days, if stated'),
  validUntil: z.string().optional().describe('The date the quote is valid until, as YYYY-MM-DD, if stated'),
  transportMode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road']).optional(),
  notes: z.string().optional().describe('Exclusions and conditions worth knowing, in one or two short sentences'),
});

/**
 * Read a forwarder's quote into a draft quote
 *
 * Takes the forwarder's PDF or image, or the text of their email, and returns
 * the fields of the quote form filled in. Nothing is saved: the person checks
 * it against the document and saves. The forwarder is matched to the list on
 * file by email domain, then name; the sum of the lines is compared with the
 * printed total, because a misread line is the error that matters.
 *
 * @example
 *   await trpcClient.logistics.admin.quotes.extract.mutate({ file: { base64, mimeType: 'application/pdf', fileName } });
 */
const adminExtractQuote = adminProcedure
  .input(
    z
      .object({
        file: z
          .object({
            base64: z.string().max(14_000_000, 'The file must be under 10 MB'),
            mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
            fileName: z.string(),
          })
          .optional(),
        text: z.string().max(60_000).optional(),
      })
      .refine((v) => v.file || v.text?.trim(), 'Attach the quote or paste the email'),
  )
  .mutation(async ({ input }) => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Reading quotes is not configured' });
    }

    const anthropic = createAnthropic({ apiKey: anthropicKey });
    const instruction =
      'This is a freight forwarder quoting to Craft & Culture (a wine importer, the customer). Read the quote. Amounts as numbers only, in the currency printed. Do not convert currencies.';

    const content = input.file
      ? [
          { type: 'text' as const, text: instruction },
          input.file.mimeType === 'application/pdf'
            ? { type: 'file' as const, data: input.file.base64, mediaType: 'application/pdf' as const }
            : { type: 'image' as const, image: input.file.base64 },
          ...(input.text?.trim() ? [{ type: 'text' as const, text: `Covering email:\n${input.text}` }] : []),
        ]
      : [{ type: 'text' as const, text: `${instruction}\n\nQUOTE EMAIL:\n${input.text}` }];

    let extracted: z.infer<typeof extractedSchema>;

    try {
      const result = await generateObject({
        model: anthropic('claude-sonnet-5'),
        schema: extractedSchema,
        system: 'You read freight quotes accurately. Never invent a figure that is not printed.',
        messages: [{ role: 'user', content }],
      });
      extracted = result.object;
    } catch (error) {
      logger.error('Failed to read freight quote', { error });
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The quote could not be read; enter it by hand' });
    }

    const domain = forwarderEmailDomain(extracted.forwarderEmail);
    const [byDomain] = domain
      ? await db
          .select({ id: logisticsForwarders.id, name: logisticsForwarders.name })
          .from(logisticsForwarders)
          .where(sql`${domain} = ANY(${logisticsForwarders.emailDomains})`)
          .limit(1)
      : [];
    const [byName] = byDomain
      ? [byDomain]
      : await db
          .select({ id: logisticsForwarders.id, name: logisticsForwarders.name })
          .from(logisticsForwarders)
          .where(sql`lower(${logisticsForwarders.name}) = lower(${extracted.forwarderName.trim()})`)
          .limit(1);

    const lineSum = Math.round(extracted.lineItems.reduce((s, l) => s + l.total, 0) * 100) / 100;
    const validUntil = extracted.validUntil && /^\d{4}-\d{2}-\d{2}$/.test(extracted.validUntil) ? extracted.validUntil : null;

    return {
      ...extracted,
      currency: extracted.currency.trim().toUpperCase().slice(0, 3),
      validUntil,
      /** A validity already gone is usually the quote date misread; the person is asked to check it */
      validUntilInPast: !!validUntil && validUntil < new Date().toISOString().slice(0, 10),
      forwarderId: byName?.id ?? null,
      /** The name on file when matched, so the person sees which forwarder it went to */
      matchedForwarderName: byName?.name ?? null,
      lineSum,
      linesMatchTotal: extracted.lineItems.length === 0 || Math.abs(lineSum - extracted.totalPrice) < 0.01,
    };
  });

export default adminExtractQuote;
