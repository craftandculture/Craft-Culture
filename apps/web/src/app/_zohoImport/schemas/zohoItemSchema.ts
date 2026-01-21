import { z } from 'zod';

/**
 * Schema for a single Zoho import item
 */
const zohoItemSchema = z.object({
  id: z.string().describe('Unique ID for tracking'),
  originalText: z.string().describe('Original text from invoice'),
  productName: z.string().describe('Extracted product name'),
  vintage: z.string().nullable().describe('Vintage year'),
  bottleSize: z.number().describe('Bottle size in ml'),
  caseConfig: z.number().describe('Bottles per case'),
  quantity: z.number().describe('Number of cases'),

  // LWIN match data
  lwin7: z.string().nullable().describe('7-digit LWIN code'),
  lwinDisplayName: z.string().nullable().describe('Display name from LWIN database'),
  matchConfidence: z.number().describe('Match confidence 0-1'),
  country: z.string().nullable().describe('Country of origin'),
  region: z.string().nullable().describe('Wine region'),
  wineType: z.string().nullable().describe('Wine type (wine, fortified, spirit)'),
  wineColour: z.string().nullable().describe('Wine colour (red, white, rose)'),
  subType: z.string().nullable().describe('Wine sub-type'),

  // Derived fields
  hsCode: z.string().describe('HS tariff code'),
  sku: z.string().describe('Generated SKU (LWIN18 format)'),

  // Flags
  hasLwinMatch: z.boolean().describe('Whether LWIN match was found'),
  needsReview: z.boolean().describe('Whether item needs manual review'),
});

export type ZohoItem = z.infer<typeof zohoItemSchema>;

export default zohoItemSchema;
