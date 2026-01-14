import db from '../src/database/client';
import { sql } from 'drizzle-orm';

const main = async () => {
  const results = await db.execute(sql`
    SELECT lwin18, name, producer, year
    FROM products
    WHERE LOWER(name) LIKE '%beaucastel%'
       OR LOWER(producer) LIKE '%beaucastel%'
    LIMIT 10
  `);

  console.log(JSON.stringify(results.rows, null, 2));
  process.exit(0);
};

main();
