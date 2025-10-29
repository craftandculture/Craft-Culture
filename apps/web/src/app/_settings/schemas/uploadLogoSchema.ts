import { z } from 'zod';

/**
 * Schema for uploading company logo
 */
const uploadLogoSchema = z.object({
  file: z.string(), // base64 encoded image
  filename: z.string(),
  fileType: z.enum(['image/png', 'image/jpeg', 'image/jpg']),
});

export default uploadLogoSchema;
