/* eslint-disable turbo/no-undeclared-env-vars */
/**
 * Import LWIN database from Excel file to Neon
 *
 * Run with: DB_URL="..." node_modules/.bin/tsx scripts/import-lwin.ts
 */

import postgres from 'postgres';
import * as XLSX from 'xlsx';

const DB_URL = process.env.DB_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DB_URL or DATABASE_URL environment variable required');
  process.exit(1);
}

const EXCEL_PATH = '/Users/kevinbradford/Downloads/LWINdatabase.xlsx';
const BATCH_SIZE = 500;

interface LwinRow {
  LWIN: number;
  STATUS: string;
  DISPLAY_NAME: string;
  PRODUCER_TITLE: string;
  PRODUCER_NAME: string;
  WINE: string;
  COUNTRY: string;
  REGION: string;
  SUB_REGION: string;
  SITE: string;
  PARCEL: string;
  COLOUR: string;
  TYPE: string;
  SUB_TYPE: string;
  DESIGNATION: string;
  CLASSIFICATION: string;
  VINTAGE_CONFIG: string;
  FIRST_VINTAGE: string;
  FINAL_VINTAGE: string;
  DATE_ADDED: number;
  DATE_UPDATED: number;
  REFERENCE: string;
}

/**
 * Convert Excel serial date to ISO string
 */
const excelDateToIso = (serial: number | undefined): string | null => {
  if (!serial || serial < 1) return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  return new Date(utc_value * 1000).toISOString();
};

/**
 * Normalize colour value to match enum
 */
const normalizeColour = (colour: string | undefined): string | null => {
  if (!colour || colour === 'NA') return null;
  const lower = colour.toLowerCase().trim();
  const mapping: Record<string, string> = {
    red: 'red',
    white: 'white',
    rosé: 'rose',
    rose: 'rose',
    pink: 'rose',
    amber: 'amber',
    orange: 'orange',
    mixed: 'mixed',
  };
  return mapping[lower] || null;
};

/**
 * Normalize type value to match enum
 */
const normalizeType = (type: string | undefined): string | null => {
  if (!type || type === 'NA') return null;
  const lower = type.toLowerCase().trim();
  const mapping: Record<string, string> = {
    wine: 'wine',
    fortified: 'fortified',
    spirit: 'spirit',
    spirits: 'spirit',
    beer: 'beer',
    cider: 'cider',
    sake: 'sake',
  };
  return mapping[lower] || 'other';
};

/**
 * Normalize status value to match enum
 */
const normalizeStatus = (status: string | undefined): string => {
  if (!status) return 'live';
  const lower = status.toLowerCase().trim();
  return lower === 'obsolete' ? 'obsolete' : 'live';
};

/**
 * Clean string value - convert "NA" to null
 */
const cleanString = (val: string | undefined): string | null => {
  if (!val || val === 'NA' || val.trim() === '') return null;
  return val.trim();
};

const importLwin = async () => {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<LwinRow>(sheet);

  console.log(`Found ${rows.length} wines to import`);

  const sql = postgres(DB_URL!, { prepare: false });

  // Process in batches
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const values = batch
      .map((row) => {
        const displayName = row.DISPLAY_NAME;

        if (!displayName) {
          skipped++;
          return null;
        }

        return {
          lwin: String(row.LWIN),
          status: normalizeStatus(row.STATUS),
          display_name: displayName,
          producer_title: cleanString(row.PRODUCER_TITLE),
          producer_name: cleanString(row.PRODUCER_NAME),
          wine: cleanString(row.WINE),
          country: cleanString(row.COUNTRY),
          region: cleanString(row.REGION),
          sub_region: cleanString(row.SUB_REGION),
          site: cleanString(row.SITE),
          parcel: cleanString(row.PARCEL),
          colour: normalizeColour(row.COLOUR),
          type: normalizeType(row.TYPE),
          sub_type: cleanString(row.SUB_TYPE),
          designation: cleanString(row.DESIGNATION),
          classification: cleanString(row.CLASSIFICATION),
          vintage_config: cleanString(row.VINTAGE_CONFIG),
          first_vintage: cleanString(row.FIRST_VINTAGE),
          final_vintage: cleanString(row.FINAL_VINTAGE),
          reference: cleanString(row.REFERENCE),
          date_added: excelDateToIso(row.DATE_ADDED),
          date_updated: excelDateToIso(row.DATE_UPDATED),
        };
      })
      .filter(Boolean);

    if (values.length === 0) continue;

    // Use postgres.js tagged template for bulk insert
    try {
      await sql`
        INSERT INTO lwin_wines ${sql(
          values as Array<{
            lwin: string;
            status: string;
            display_name: string;
            producer_title: string | null;
            producer_name: string | null;
            wine: string | null;
            country: string | null;
            region: string | null;
            sub_region: string | null;
            site: string | null;
            parcel: string | null;
            colour: string | null;
            type: string | null;
            sub_type: string | null;
            designation: string | null;
            classification: string | null;
            vintage_config: string | null;
            first_vintage: string | null;
            final_vintage: string | null;
            reference: string | null;
            date_added: string | null;
            date_updated: string | null;
          }>,
          'lwin',
          'status',
          'display_name',
          'producer_title',
          'producer_name',
          'wine',
          'country',
          'region',
          'sub_region',
          'site',
          'parcel',
          'colour',
          'type',
          'sub_type',
          'designation',
          'classification',
          'vintage_config',
          'first_vintage',
          'final_vintage',
          'reference',
          'date_added',
          'date_updated',
        )}
        ON CONFLICT (lwin) DO UPDATE SET
          status = EXCLUDED.status,
          display_name = EXCLUDED.display_name,
          producer_title = EXCLUDED.producer_title,
          producer_name = EXCLUDED.producer_name,
          wine = EXCLUDED.wine,
          country = EXCLUDED.country,
          region = EXCLUDED.region,
          sub_region = EXCLUDED.sub_region,
          site = EXCLUDED.site,
          parcel = EXCLUDED.parcel,
          colour = EXCLUDED.colour,
          type = EXCLUDED.type,
          sub_type = EXCLUDED.sub_type,
          designation = EXCLUDED.designation,
          classification = EXCLUDED.classification,
          vintage_config = EXCLUDED.vintage_config,
          first_vintage = EXCLUDED.first_vintage,
          final_vintage = EXCLUDED.final_vintage,
          reference = EXCLUDED.reference,
          date_added = EXCLUDED.date_added,
          date_updated = EXCLUDED.date_updated,
          updated_at = NOW()
      `;

      imported += values.length;
      console.log(`Imported ${imported}/${rows.length} wines...`);
    } catch (error) {
      console.error('Batch error:', error);
      throw error;
    }
  }

  await sql.end();

  console.log(`\nImport complete!`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped: ${skipped}`);
};

importLwin().catch(console.error);
