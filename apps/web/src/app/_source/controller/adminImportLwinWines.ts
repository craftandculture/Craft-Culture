import { sql } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { z } from 'zod';

import db from '@/database/client';
import { lwinWines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

const importLwinSchema = z.object({
  fileContent: z.string().describe('Base64 encoded Excel/CSV file'),
  fileName: z.string(),
});

interface ParsedWineRow {
  lwin: string;
  displayName: string;
  producerTitle?: string;
  producerName?: string;
  wine?: string;
  country?: string;
  region?: string;
  subRegion?: string;
  site?: string;
  parcel?: string;
  colour?: string;
  type?: string;
  subType?: string;
  designation?: string;
  classification?: string;
  vintageConfig?: string;
  firstVintage?: string;
  finalVintage?: string;
  status?: string;
  reference?: string;
  dateAdded?: string;
  dateUpdated?: string;
}

/**
 * Normalize column headers for flexible matching
 */
const normalizeHeader = (header: string): string => {
  return header
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '')
    .replace(/[^\w]/g, '');
};

/**
 * Map common header variations to our schema fields
 */
const HEADER_MAPPINGS: Record<string, keyof ParsedWineRow> = {
  lwin: 'lwin',
  lwin7: 'lwin',
  displayname: 'displayName',
  display: 'displayName',
  name: 'displayName',
  winename: 'displayName',
  producertitle: 'producerTitle',
  producername: 'producerName',
  producer: 'producerName',
  wine: 'wine',
  winetype: 'wine',
  country: 'country',
  region: 'region',
  subregion: 'subRegion',
  sub_region: 'subRegion',
  site: 'site',
  parcel: 'parcel',
  colour: 'colour',
  color: 'colour',
  type: 'type',
  subtype: 'subType',
  sub_type: 'subType',
  designation: 'designation',
  classification: 'classification',
  vintageconfig: 'vintageConfig',
  vintage_config: 'vintageConfig',
  firstvintage: 'firstVintage',
  first_vintage: 'firstVintage',
  finalvintage: 'finalVintage',
  final_vintage: 'finalVintage',
  status: 'status',
  reference: 'reference',
  dateadded: 'dateAdded',
  date_added: 'dateAdded',
  dateupdated: 'dateUpdated',
  date_updated: 'dateUpdated',
};

/**
 * Parse a CSV line handling quoted values
 */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        // End of quoted section
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current.trim());
  return result;
};

/**
 * Get cell value as string
 */
const getCellValue = (cell: ExcelJS.Cell): string => {
  const value = cell.value;

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object' && 'result' in value) {
    return String(value.result ?? '');
  }

  if (typeof value === 'object' && 'text' in value) {
    return String(value.text ?? '');
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
};

/**
 * Parse colour to enum value
 */
const parseColour = (colour: string | undefined): 'red' | 'white' | 'rose' | 'amber' | 'orange' | 'mixed' | null => {
  if (!colour) return null;

  const normalized = colour.toLowerCase().trim();
  const colourMap: Record<string, 'red' | 'white' | 'rose' | 'amber' | 'orange' | 'mixed'> = {
    red: 'red',
    white: 'white',
    rose: 'rose',
    rosé: 'rose',
    amber: 'amber',
    orange: 'orange',
    mixed: 'mixed',
  };

  return colourMap[normalized] || null;
};

/**
 * Parse type to enum value
 */
const parseType = (type: string | undefined): 'wine' | 'fortified' | 'spirit' | 'beer' | 'cider' | 'sake' | 'other' | null => {
  if (!type) return null;

  const normalized = type.toLowerCase().trim();
  const typeMap: Record<string, 'wine' | 'fortified' | 'spirit' | 'beer' | 'cider' | 'sake' | 'other'> = {
    wine: 'wine',
    fortified: 'fortified',
    spirit: 'spirit',
    spirits: 'spirit',
    beer: 'beer',
    cider: 'cider',
    sake: 'sake',
    other: 'other',
  };

  return typeMap[normalized] || 'wine';
};

/**
 * Parse date string to Date object
 */
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
};

/**
 * Import LWIN wines from Excel/CSV file
 *
 * Supports flexible column mapping for Liv-ex LWIN database exports.
 * Performs upsert - existing wines are updated, new wines are inserted.
 *
 * @example
 *   await trpcClient.source.admin.importLwinWines.mutate({
 *     fileContent: base64EncodedFile,
 *     fileName: "lwin_database.xlsx"
 *   });
 */
const adminImportLwinWines = adminProcedure
  .input(importLwinSchema)
  .mutation(async ({ input }) => {
    const { fileContent, fileName } = input;

    // Decode base64 file
    const buffer = Buffer.from(fileContent, 'base64');
    const workbook = new ExcelJS.Workbook();

    // Try to load as Excel, fall back to CSV
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
    } catch {
      // Try CSV format
      try {
        const csvText = buffer.toString('utf-8');
        const lines = csvText.split('\n');
        const ws = workbook.addWorksheet('Sheet1');
        lines.forEach((line, rowIndex) => {
          // Handle CSV parsing with quoted values
          const cells = parseCSVLine(line);
          cells.forEach((cell, colIndex) => {
            ws.getCell(rowIndex + 1, colIndex + 1).value = cell;
          });
        });
      } catch {
        throw new Error('Unable to parse file. Please ensure it is a valid Excel or CSV file.');
      }
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('No worksheet found in the file');
    }

    // Get headers from first row
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      const value = getCellValue(cell);
      headers.push(value);
    });

    // Map headers to our schema
    const columnMapping: Map<number, keyof ParsedWineRow> = new Map();
    headers.forEach((header, index) => {
      const normalized = normalizeHeader(header);
      const mappedField = HEADER_MAPPINGS[normalized];
      if (mappedField) {
        columnMapping.set(index, mappedField);
      }
    });

    // Verify we have the required LWIN column
    const hasLwin = Array.from(columnMapping.values()).includes('lwin');
    if (!hasLwin) {
      throw new Error('Required column "LWIN" not found in the file');
    }

    // Parse data rows
    const wines: ParsedWineRow[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
      // Skip header row
      if (rowIndex === 1) return;

      const wine: Partial<ParsedWineRow> = {};

      row.eachCell({ includeEmpty: true }, (cell, colIndex) => {
        const field = columnMapping.get(colIndex - 1); // 1-indexed to 0-indexed
        if (field) {
          const value = getCellValue(cell);
          if (value) {
            wine[field] = value;
          }
        }
      });

      // Skip rows without LWIN
      if (wine.lwin && wine.lwin.trim()) {
        wines.push(wine as ParsedWineRow);
      }
    });

    if (wines.length === 0) {
      throw new Error('No valid wines found in the file');
    }

    logger.dev(`Importing ${wines.length} wines from ${fileName}`);

    // Process in batches to avoid memory issues
    const batchSize = 500;
    let imported = 0;
    const updated = 0;
    let errors = 0;

    for (let i = 0; i < wines.length; i += batchSize) {
      const batch = wines.slice(i, i + batchSize);

      try {
        // Upsert batch
        const result = await db
          .insert(lwinWines)
          .values(
            batch.map((wine) => ({
              lwin: wine.lwin.trim(),
              displayName: wine.displayName || wine.lwin,
              producerTitle: wine.producerTitle || null,
              producerName: wine.producerName || null,
              wine: wine.wine || null,
              country: wine.country || null,
              region: wine.region || null,
              subRegion: wine.subRegion || null,
              site: wine.site || null,
              parcel: wine.parcel || null,
              colour: parseColour(wine.colour),
              type: parseType(wine.type),
              subType: wine.subType || null,
              designation: wine.designation || null,
              classification: wine.classification || null,
              vintageConfig: wine.vintageConfig || null,
              firstVintage: wine.firstVintage || null,
              finalVintage: wine.finalVintage || null,
              status: wine.status?.toLowerCase() === 'obsolete' ? 'obsolete' : 'live',
              reference: wine.reference || null,
              dateAdded: wine.dateAdded ? parseDate(wine.dateAdded) : null,
              dateUpdated: wine.dateUpdated ? parseDate(wine.dateUpdated) : null,
            })),
          )
          .onConflictDoUpdate({
            target: lwinWines.lwin,
            set: {
              displayName: sql`EXCLUDED.display_name`,
              producerTitle: sql`EXCLUDED.producer_title`,
              producerName: sql`EXCLUDED.producer_name`,
              wine: sql`EXCLUDED.wine`,
              country: sql`EXCLUDED.country`,
              region: sql`EXCLUDED.region`,
              subRegion: sql`EXCLUDED.sub_region`,
              site: sql`EXCLUDED.site`,
              parcel: sql`EXCLUDED.parcel`,
              colour: sql`EXCLUDED.colour`,
              type: sql`EXCLUDED.type`,
              subType: sql`EXCLUDED.sub_type`,
              designation: sql`EXCLUDED.designation`,
              classification: sql`EXCLUDED.classification`,
              vintageConfig: sql`EXCLUDED.vintage_config`,
              firstVintage: sql`EXCLUDED.first_vintage`,
              finalVintage: sql`EXCLUDED.final_vintage`,
              status: sql`EXCLUDED.status`,
              reference: sql`EXCLUDED.reference`,
              dateAdded: sql`EXCLUDED.date_added`,
              dateUpdated: sql`EXCLUDED.date_updated`,
              updatedAt: new Date(),
            },
          })
          .returning({ lwin: lwinWines.lwin });

        imported += result.length;
      } catch (error) {
        logger.dev(`Error importing batch ${i / batchSize + 1}`, { error });
        errors += batch.length;
      }
    }

    logger.dev(`Import complete: ${imported} wines imported, ${errors} errors`);

    return {
      success: true,
      imported,
      updated,
      errors,
      total: wines.length,
    };
  });

export default adminImportLwinWines;
