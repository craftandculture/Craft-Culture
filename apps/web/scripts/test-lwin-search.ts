/* eslint-disable */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import postgres from 'postgres';

const sql = postgres(process.env.DB_URL!, { ssl: 'require' });

async function testSearch(query: string) {
  console.log(`\n=== Searching: "${query}" ===`);

  const searchPattern = `%${query}%`;

  const results = await sql`
    SELECT
      lwin,
      display_name,
      producer_name,
      country,
      region,
      classification,
      vintage_config
    FROM lwin_wines
    WHERE status = 'live'
      AND (
        display_name ILIKE ${searchPattern}
        OR producer_name ILIKE ${searchPattern}
        OR wine ILIKE ${searchPattern}
      )
    ORDER BY
      CASE WHEN LOWER(producer_name) = ${query.toLowerCase()} THEN 0 ELSE 1 END,
      LENGTH(display_name)
    LIMIT 5
  `;

  console.log(`Found ${results.length} results:`);
  results.forEach((r: any, i: number) => {
    console.log(`  ${i+1}. ${r.display_name}`);
    console.log(`     LWIN7: ${r.lwin} | ${r.producer_name} | ${r.region}, ${r.country}`);
    if (r.classification) console.log(`     Classification: ${r.classification}`);
    console.log(`     Vintage Config: ${r.vintage_config}`);
  });
}

async function main() {
  console.log('Testing LWIN Search API...\n');

  await testSearch('Lafite');
  await testSearch('Opus One');
  await testSearch('Margaux');
  await testSearch('Petrus');
  await testSearch('Dom Perignon');
  await testSearch('Fontenil');

  console.log('\n=== Done ===');
  await sql.end();
  process.exit(0);
}

main().catch(console.error);
