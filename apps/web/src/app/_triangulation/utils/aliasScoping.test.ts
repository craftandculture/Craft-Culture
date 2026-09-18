import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * `tri_sku_aliases.programme_id` defaults to Crurated.
 *
 * An INSERT that omits it therefore writes into Crurated's namespace whatever
 * client the alias belongs to — and because the table's unique key is
 * (programme_id, source, normalized_code), the ON CONFLICT that follows then
 * repoints Crurated's existing alias at the other client's SKU. One client
 * mapping a code silently rewrote another's mapping.
 *
 * Found in four controllers at once, so it is checked rather than remembered.
 * The programme always comes from the SKU the alias is being attached to.
 */
const CONTROLLERS = path.join(__dirname, '..', 'controller');

describe('every alias insert names its programme', () => {
  const files = fs
    .readdirSync(CONTROLLERS)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(CONTROLLERS, name), 'utf8'),
    }))
    .filter(({ source }) => source.includes('INSERT INTO tri_sku_aliases'));

  it('finds the controllers that write aliases', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map(({ name }) => name))('%s passes programme_id', (name) => {
    const source = files.find((file) => file.name === name)!.source;
    const offenders: string[] = [];

    /*
      The column list of each insert, up to its closing bracket. Matching the
      whole statement would let a programme_id in the ON CONFLICT clause
      satisfy a column list that omits it.
    */
    for (const match of source.matchAll(
      /INSERT INTO tri_sku_aliases\s*\(([\s\S]*?)\)/g,
    )) {
      if (!(match[1] ?? '').includes('programme_id')) {
        offenders.push((match[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 70));
      }
    }

    expect(
      offenders,
      `${name} inserts an alias without a programme, so it lands in Crurated's namespace and can repoint another client's alias`,
    ).toEqual([]);
  });
});
