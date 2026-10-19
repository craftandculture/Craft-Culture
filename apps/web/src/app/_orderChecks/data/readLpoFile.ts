import { createAnthropic } from '@ai-sdk/anthropic';
import { TRPCError } from '@trpc/server';
import { generateObject } from 'ai';
import pdfParse from 'pdf-parse';
import { z } from 'zod';

import parseAnyLpoText from '@/app/_lpo/utils/parseAnyLpoText';
import type { LpoLine, ParsedLpo } from '@/app/_lpo/utils/parseLpoText';
import logger from '@/utils/logger';

const scannedLpoSchema = z.object({
  poNumber: z.string().nullable().describe('The LPO / PO / order form number, e.g. "8828" from "Serial No: 8828"'),
  poDate: z.string().nullable().describe('The order date as printed'),
  client: z.string().nullable().describe('The BUYER who issued the order (the company whose form this is), not the supplier'),
  creditTerms: z.string().nullable().describe('Payment or credit terms exactly as printed, e.g. "SIXTY (60) DAYS CREDIT TERMS"'),
  currency: z.string().nullable().describe('Currency code of the prices, e.g. AED'),
  declaredTotal: z.number().nullable().describe('The grand total the document states'),
  lines: z.array(
    z.object({
      wine: z.string().describe('The product name exactly as written, without the vintage'),
      vintage: z.string().describe('Four-digit vintage, or "NV"; empty string if not stated'),
      pack: z.number().nullable().describe('Bottles per case, e.g. 6 from "6X75CL"'),
      sizeMl: z.number().nullable().describe('Bottle size in millilitres, e.g. 750 from "75CL"'),
      quantity: z.number().describe('Quantity ordered, as written'),
      quantityIsCases: z.boolean().describe('True when the quantity counts cases, false when it counts bottles'),
      unitPrice: z.number().describe('Price per unit as written (per case when quantity counts cases)'),
      lineTotal: z.number().nullable().describe('Line total / sub-total as written'),
    }),
  ),
});

/** Where the LPO's figures came from, so the screen can say how far to trust them */
export type LpoReadBy = 'text' | 'scan';

const fromScan = (s: z.infer<typeof scannedLpoSchema>): ParsedLpo => {
  const lines: LpoLine[] = s.lines.map((l) => {
    const pack = l.pack && l.pack > 0 ? l.pack : null;
    const bottles = l.quantityIsCases && pack ? l.quantity * pack : l.quantity;
    const unitPriceAed = l.quantityIsCases && pack ? l.unitPrice / pack : l.unitPrice;
    const lineTotalAed = l.lineTotal ?? l.unitPrice * l.quantity;
    const sums = Math.abs(l.unitPrice * l.quantity - lineTotalAed) <= 0.01;
    return {
      region: '',
      wine: l.wine,
      vintage: l.vintage,
      volumeText: l.sizeMl ? `${l.sizeMl / 10}cl` : '',
      sizeMl: l.sizeMl ?? 0,
      bottles,
      unitPriceAed,
      lineTotalAed,
      problem: sums ? null : `${l.quantity} × ${l.unitPrice} is not ${lineTotalAed}`,
      ...(l.quantityIsCases ? { cases: l.quantity, unitPriceCaseAed: l.unitPrice } : {}),
      ...(pack ? { pack } : {}),
    };
  });

  return {
    poNumber: s.poNumber,
    poDate: s.poDate,
    client: s.client,
    creditTerms: s.creditTerms,
    lines,
    totalBottles: lines.reduce((sum, l) => sum + l.bottles, 0),
    computedTotalAed: lines.reduce((sum, l) => sum + l.lineTotalAed, 0),
    declaredTotalAed: s.declaredTotal,
    skipped: [],
  };
};

/**
 * Read a client's LPO from a PDF or a photo of it
 *
 * A PDF with text goes through the same deterministic parsers as Client LPOs,
 * so the two screens can never read one order two ways. A scan or photo has
 * no text to parse; it is read by Claude instead, and marked as read from a
 * scan so whoever checks the order knows the figures came from an image.
 *
 * A misread figure is not a quiet risk here: it shows up as a difference
 * against our sales order, which a person then looks at.
 *
 * @example
 *   const { lpo, readBy } = await readLpoFile(base64, 'image/jpeg');
 *
 * @param base64 - The file, base64 without the data-URL prefix
 * @param mediaType - 'application/pdf', 'image/jpeg', 'image/png' …
 * @returns The parsed LPO and how it was read
 */
const readLpoFile = async (base64: string, mediaType: string): Promise<{ lpo: ParsedLpo; readBy: LpoReadBy }> => {
  if (mediaType === 'application/pdf') {
    try {
      const text = (await pdfParse(Buffer.from(base64, 'base64'))).text;
      const parsed = parseAnyLpoText(text);
      if (parsed.lines.length > 0) return { lpo: parsed, readBy: 'text' };
    } catch (error) {
      logger.warn('LPO PDF had no readable text; reading it as a scan', { error });
    }
  } else if (!mediaType.startsWith('image/')) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Attach the LPO as a PDF or a photo (JPG or PNG)' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'This LPO is a scan, and reading scans needs ANTHROPIC_API_KEY, which is not set',
    });
  }

  const anthropic = createAnthropic({ apiKey });
  const file =
    mediaType === 'application/pdf'
      ? { type: 'file' as const, data: base64, mediaType: 'application/pdf' as const }
      : { type: 'image' as const, image: base64, mediaType };

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-6'),
    schema: scannedLpoSchema,
    system:
      'You read purchase orders (LPOs) that wine buyers send to their supplier. Transcribe exactly what is printed. ' +
      'Never correct, round or complete a figure; if something is not printed, return null. ' +
      'Every product row is a line; totals rows, terms and signatures are not.',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'Read this purchase order.' }, file] }],
  });

  return { lpo: fromScan(object), readBy: 'scan' };
};

export default readLpoFile;
