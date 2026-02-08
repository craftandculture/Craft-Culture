/* eslint-disable */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import postgres from 'postgres';

const sql = postgres(process.env.DB_URL!, { ssl: 'require' });

interface InvoiceItem {
  description: string;
  searchTerms: string[];
  vintage: number | null;
  bottleSizeMl: number;
  caseSize?: number;
}

const invoiceItems: InvoiceItem[] = [
  {
    description: 'François Thienpont Terre Elysée 2021 0.75L 12',
    searchTerms: ['Thienpont', 'Terre Elysee'],
    vintage: 2021,
    bottleSizeMl: 750,
    caseSize: 12,
  },
  {
    description: 'RUM Dictador x Crurated Exclusive Single Cask Port Finish 1999 0.7L 43',
    searchTerms: ['Dictador'],
    vintage: 1999,
    bottleSizeMl: 700,
    caseSize: 43, // This is likely alcohol % not case size
  },
  {
    description: 'Davide Fregonese Barolo DOCG Prapò 2019 0.75L 14',
    searchTerms: ['Fregonese', 'Barolo', 'Prapo'],
    vintage: 2019,
    bottleSizeMl: 750,
  },
  {
    description: 'Masseria Alfano Fiano d\'Avellino DOCG Riserva Il Gheppio 2020 0.75L 12.5',
    searchTerms: ['Masseria Alfano', 'Fiano', 'Gheppio'],
    vintage: 2020,
    bottleSizeMl: 750,
  },
  {
    description: 'Domaine Lafouge Meursault Les Meix-Chavaux 2022 0.75L 13',
    searchTerms: ['Lafouge', 'Meursault', 'Meix-Chavaux'],
    vintage: 2022,
    bottleSizeMl: 750,
  },
  {
    description: 'Theo Dancer Jurassic Savagnin 2023 0.75L 12.5',
    searchTerms: ['Theo Dancer', 'Savagnin', 'Jurassic'],
    vintage: 2023,
    bottleSizeMl: 750,
  },
  {
    description: 'Masseria Alfano Fiano d\'Avellino DOCG Riserva Il Gheppio 2021 0.75L 12.5',
    searchTerms: ['Masseria Alfano', 'Fiano', 'Gheppio'],
    vintage: 2021,
    bottleSizeMl: 750,
  },
  {
    description: 'Étienne Calsac Champagne Les Revenants 2020 0.75L 12.5',
    searchTerms: ['Calsac', 'Revenants', 'Champagne'],
    vintage: 2020,
    bottleSizeMl: 750,
  },
];

async function searchLwin(searchTerm: string) {
  const searchPattern = `%${searchTerm}%`;

  const results = await sql`
    SELECT
      lwin,
      display_name,
      producer_name,
      wine,
      country,
      region,
      sub_region,
      classification,
      vintage_config
    FROM lwin_wines
    WHERE status = 'live'
      AND (
        display_name ILIKE ${searchPattern}
        OR producer_name ILIKE ${searchPattern}
        OR wine ILIKE ${searchPattern}
      )
    ORDER BY LENGTH(display_name)
    LIMIT 3
  `;

  return results;
}

function buildLwin18(lwin7: string, vintage: number | null, caseSize: number, bottleSizeMl: number): string {
  const vintageStr = vintage ? String(vintage).padStart(4, '0') : '0000';
  const caseSizeStr = String(caseSize).padStart(2, '0');
  const bottleSizeStr = String(bottleSizeMl).padStart(5, '0');
  return `${lwin7}${vintageStr}${caseSizeStr}${bottleSizeStr}`;
}

async function main() {
  console.log('=== CRURATED Invoice LWIN Lookup ===\n');

  for (const item of invoiceItems) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`INVOICE: ${item.description}`);
    console.log(`${'='.repeat(70)}`);

    let foundMatch = false;

    for (const term of item.searchTerms) {
      if (foundMatch) break;

      const results = await searchLwin(term);

      if (results.length > 0) {
        console.log(`\nSearching "${term}" - Found ${results.length} match(es):`);

        for (const r of results) {
          const result = r as any;
          console.log(`\n  ✓ ${result.display_name}`);
          console.log(`    LWIN7: ${result.lwin}`);
          console.log(`    Producer: ${result.producer_name}`);
          console.log(`    Region: ${result.region}, ${result.country}`);
          if (result.classification) console.log(`    Classification: ${result.classification}`);

          // Build suggested LWIN18 (assuming 6-pack if not specified)
          const caseSize = item.caseSize && item.caseSize <= 24 ? item.caseSize : 6;
          const lwin18 = buildLwin18(result.lwin, item.vintage, caseSize, item.bottleSizeMl);
          console.log(`    → Suggested LWIN18: ${lwin18}`);

          foundMatch = true;
        }
      }
    }

    if (!foundMatch) {
      console.log(`\n  ✗ NO MATCH FOUND in LWIN database`);
      console.log(`    This wine may need to be added manually or is not in Liv-ex database`);
    }
  }

  console.log('\n\n=== Summary ===');
  console.log('Some wines from small/boutique producers may not be in the Liv-ex database.');
  console.log('For those, you can create a custom SKU or request Liv-ex to add them.\n');

  await sql.end();
  process.exit(0);
}

main().catch(console.error);
