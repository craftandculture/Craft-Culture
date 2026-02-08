/* eslint-disable */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import postgres from 'postgres';

const sql = postgres(process.env.DB_URL!, { ssl: 'require' });

async function searchLwin(searchTerm: string, limit = 8) {
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
    LIMIT ${limit}
  `;

  return results;
}

async function main() {
  console.log('=== Deeper LWIN Search ===\n');

  const searches = [
    { term: 'Savagnin', context: 'Looking for Theo Dancer Jurassic Savagnin' },
    { term: 'Masseria Alfano', context: 'Looking for Fiano d\'Avellino producer' },
    { term: 'Alfano', context: 'Broader search for Alfano' },
    { term: 'Gheppio', context: 'Looking for Il Gheppio wine name' },
    { term: 'Fiano Avellino', context: 'Looking for Fiano d\'Avellino wines' },
    { term: 'Terre Elysee', context: 'Looking for Thienpont Terre Elysée' },
    { term: 'Jurassic', context: 'Looking for Jurassic wines (Jura region)' },
  ];

  for (const { term, context } of searches) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Search: "${term}"`);
    console.log(`Context: ${context}`);
    console.log(`${'='.repeat(70)}`);

    const results = await searchLwin(term);

    if (results.length === 0) {
      console.log(`\n  ✗ NO RESULTS for "${term}"`);
    } else {
      console.log(`\nFound ${results.length} result(s):\n`);
      for (const r of results) {
        const result = r as any;
        console.log(`  • ${result.display_name}`);
        console.log(`    LWIN7: ${result.lwin} | ${result.producer_name}`);
        console.log(`    Region: ${result.region || 'N/A'}, ${result.country}`);
        if (result.sub_region) console.log(`    Sub-region: ${result.sub_region}`);
        if (result.classification) console.log(`    Classification: ${result.classification}`);
        console.log('');
      }
    }
  }

  await sql.end();
  process.exit(0);
}

main().catch(console.error);
