import { createAnthropic } from '@ai-sdk/anthropic';
import { TRPCError } from '@trpc/server';
import { type FilePart, type ImagePart, type TextPart, generateObject } from 'ai';
import * as XLSX from 'xlsx';
import { z } from 'zod';

import db from '@/database/client';
import { exportInvoiceVersions, exportInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { UK_BONDS } from '../constants';
import buildUkImportDocument from '../utils/buildUkImportDocument';

/** Stands in for a Zoho customer: a UK import has none, and the column is required */
export const UK_IMPORT_CUSTOMER_ID = 'uk-import';

const SPREADSHEET_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

/*
  Every field required (nullable instead of optional): the AI SDK's strict
  structured output allows few optionals, and a field the model may leave out
  is a field it will leave out.
*/
const readSchema = z.object({
  documents: z.array(
    z.object({
      reference: z.string().describe('Invoice, order or lot reference as printed, e.g. "BI565619" or "#35582". If none is printed, the file name.'),
      supplier: z.string().nullable().describe('Who issued the document, e.g. "Dreweatts", "Berry Bros. & Rudd". Null if not shown.'),
      date: z.string().nullable().describe('Document date as YYYY-MM-DD'),
      currency: z.enum(['GBP', 'USD', 'EUR']),
      goodsTotal: z
        .number()
        .nullable()
        .describe('Total of the wine lines only: hammer plus buyer premium for auctions, excluding VAT, delivery, carriage and storage. Null if not stated.'),
    }),
  ),
  lines: z.array(
    z.object({
      documentReference: z.string().describe('The reference of the document this line is on'),
      description: z.string().describe('Producer, wine, appellation and vintage exactly as written'),
      country: z.string().describe('Country of origin in English, e.g. "France"'),
      region: z.string().nullable().describe('Region, e.g. "Bordeaux", "Burgundy", "Tuscany"'),
      bottles: z.number().describe('Total bottles shipped on this line, as printed. "6 bottles" is 6; "2 x 6x75cl" is 12.'),
      packBottles: z.number().describe('Bottles per case as stated ("Case Size", "6x75cl", "OWC 12"). 1 for loose bottles. For an auction lot sold as a lot, the bottles in the lot.'),
      bottleSizeCl: z.number().describe('Bottle size in centilitres: 75, 37.5, 150, 300'),
      pricePerBottle: z.number().nullable().describe('Price per bottle in the document currency, including buyer premium for auctions'),
      lineTotal: z.number().nullable().describe('Line total in the document currency, including buyer premium, excluding VAT and delivery'),
      dutyStatus: z.enum(['IB', 'DP']).nullable().describe('IB = in bond / duty suspended, DP = duty paid. Null if the document does not say'),
      abv: z.string().nullable().describe('Alcohol by volume as printed, e.g. "13.5%"; null if not stated'),
    }),
  ),
});

const SYSTEM = `You read UK wine merchants' and auction houses' invoices, statements and screenshots so Craft and Culture can declare the wine to UAE customs.

Rules:
1. Transcribe; never invent. A wine you cannot read is left out, not guessed.
2. Every wine line on every page and every file. Count them.
3. Leave out anything that is not wine or spirits: delivery, carriage, storage, insurance, VAT, fees.
4. Auction lots: price = hammer plus buyer's premium for the lot. pricePerBottle = that ÷ bottles in the lot.
5. Read the bottle count exactly as printed; never multiply it by the case size. "6 bottles, case size 6" is bottles 6, packBottles 6. "2 bottles, case size 1" is bottles 2, packBottles 1. An auction lot of five bottles is bottles 5, packBottles 5. Two 6x75cl cases is bottles 12, packBottles 6.
6. Origin is the country the wine was made in, never the country it is stored in.
7. Duty status: "in bond", "IB", "duty suspended", "UK bond" = IB; "duty paid", "DP" = DP.`;

/**
 * Read UK supplier documents into a draft UK import invoice
 *
 * The operator drops in what they have — supplier PDFs, screenshots, an Excel
 * list — and chooses the bond the wine leaves from. Claude reads every wine
 * line; the document is then built the way the C&C (LCB) invoice of Aug 2026
 * was by hand: C&C's UK EORI as shipper, C&C FZE as importer, USD at the
 * operator's GBP rate, stamped. It opens in the same editor as an export
 * invoice, where every line can be checked and corrected before issuing.
 */
const adminCreateUkImportDraft = adminProcedure
  .input(
    z.object({
      files: z
        .array(z.object({ name: z.string(), mimeType: z.string(), data: z.string() }))
        .min(1)
        .max(8),
      bond: z.union([
        z.enum(Object.keys(UK_BONDS) as [keyof typeof UK_BONDS, ...(keyof typeof UK_BONDS)[]]),
        z.object({ name: z.string().min(2), address: z.string().min(2) }),
      ]),
      gbpUsdRate: z.number().positive().max(5),
      transport: z.enum(['Air Freight', 'Sea Freight']),
      portOfLoading: z.string().min(2),
      portOfDischarge: z.string().min(2),
      reason: z.string().optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Reading documents is not configured (ANTHROPIC_API_KEY).' });
    }

    const content: (TextPart | ImagePart | FilePart)[] = [
      { type: 'text', text: `Read every wine line from these ${input.files.length} document(s).` },
    ];

    for (const file of input.files) {
      const data = file.data.includes(',') ? (file.data.split(',')[1] ?? file.data) : file.data;
      const type = file.mimeType.toLowerCase();
      content.push({ type: 'text', text: `--- File: ${file.name} ---` });

      if (type.startsWith('image/')) {
        content.push({ type: 'image', image: data, mediaType: type });
      } else if (type === 'application/pdf') {
        content.push({ type: 'file', data, mediaType: 'application/pdf' });
      } else if (SPREADSHEET_TYPES.includes(type) || /\.(xlsx|xls|csv)$/i.test(file.name)) {
        const workbook = XLSX.read(Buffer.from(data, 'base64'), { type: 'buffer' });
        const text = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          return sheet ? `Sheet ${name}:\n${XLSX.utils.sheet_to_csv(sheet)}` : '';
        })
          .filter((t) => t.trim())
          .join('\n\n');
        content.push({ type: 'text', text: text || '(empty spreadsheet)' });
      } else {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `${file.name}: use a PDF, an image or an Excel/CSV file.` });
      }
    }

    let read: z.infer<typeof readSchema>;
    try {
      const result = await generateObject({
        model: createAnthropic({ apiKey })('claude-sonnet-5'),
        schema: readSchema,
        system: SYSTEM,
        messages: [{ role: 'user', content }],
        providerOptions: { anthropic: { structuredOutputMode: 'jsonTool' } },
      });
      read = result.object;
    } catch (error) {
      logger.error('UK import read failed', { error: error instanceof Error ? error.message : String(error) });
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not read the documents. Try a clearer copy, or fewer files at once.' });
    }

    if (read.lines.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No wine lines were found in those documents.' });
    }
    // Euro documents need their own rate, which this screen does not ask for yet
    const euro = read.documents.filter((d) => d.currency === 'EUR').map((d) => d.reference);
    if (euro.length > 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `${euro.join(', ')} ${euro.length > 1 ? 'are' : 'is'} in euros. Convert to GBP or USD first.` });
    }

    // Models write "<UNKNOWN>" or "N/A" for a field they could not find
    const known = (s: string | null) =>
      s && !/^[<[(]?\s*(unknown|n\/?a|none|null|not stated)\s*[>\])]?$/i.test(s.trim()) ? s.trim() : null;

    const currencyOf = new Map(read.documents.map((d) => [d.reference, d.currency === 'USD' ? 'USD' : 'GBP'] as const));
    const bond =
      typeof input.bond === 'string'
        ? input.bond
        : { name: input.bond.name, short: input.bond.name, address: input.bond.address };

    const document = buildUkImportDocument(
      read.documents.map((d) => ({
        reference: known(d.reference) ?? '',
        supplier: known(d.supplier) ?? '',
        date: d.date,
        currency: d.currency === 'USD' ? 'USD' : 'GBP',
        statedTotal: d.goodsTotal,
      })),
      read.lines.map((l) => ({ ...l, currency: currencyOf.get(l.documentReference) ?? 'GBP' })),
      {
        bond,
        gbpUsdRate: input.gbpUsdRate,
        transport: input.transport,
        portOfLoading: input.portOfLoading,
        portOfDischarge: input.portOfDischarge,
        reason: input.reason,
        date: new Date().toISOString().slice(0, 10),
      },
    );

    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(exportInvoices)
        .values({
          zohoCustomerId: UK_IMPORT_CUSTOMER_ID,
          consigneeName: 'Craft and Culture FZE (UK import)',
          document,
          createdBy: ctx.user.id,
        })
        .returning({ id: exportInvoices.id });
      if (!row) throw new Error('insert failed');
      await tx.insert(exportInvoiceVersions).values({
        exportInvoiceId: row.id,
        version: 1,
        document,
        ops: [],
        changeSummary: `UK import read from ${input.files.map((f) => f.name).join(', ')}`,
        createdBy: ctx.user.id,
      });
      return row.id;
    });

    return { id, lines: document.lines.length };
  });

export default adminCreateUkImportDraft;
