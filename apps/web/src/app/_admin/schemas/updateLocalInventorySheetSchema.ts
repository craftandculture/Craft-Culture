import z from 'zod';

/**
 * Schema for updating local inventory Google Sheet configuration
 */
const updateLocalInventorySheetSchema = z.object({
  googleSheetUrl: z
    .string()
    .url('Please enter a valid URL')
    .refine(
      (url) => url.includes('docs.google.com/spreadsheets'),
      'Please enter a valid Google Sheets URL',
    ),
  sheetName: z.string().optional(),
});

export default updateLocalInventorySheetSchema;
