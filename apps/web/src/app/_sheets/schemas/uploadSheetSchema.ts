import { z } from 'zod';

const uploadSheetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  googleSheetUrl: z.url('Invalid Google Sheets URL'),
});

export type UploadSheetSchema = z.infer<typeof uploadSheetSchema>;

export default uploadSheetSchema;
