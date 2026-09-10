import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Every place that matches WMS stock or a partner to an owner name.
 *
 * The match is written as "no search token is absent from the owner name",
 * which is a NOT EXISTS over the tokens. On a row whose owner is NULL, the
 * inner comparison is NULL rather than true, so no token is ever found to be
 * absent and the row passes as a match.
 *
 * That put every ownerless row into every owner's snapshot. Crurated's WMS
 * position came back as 115 rows of Langleys Gin, Altamura Vodka and NICE
 * canned wine — none of it theirs, none of it mapping to any wine — so the
 * warehouse leg of the reconciliation read zero bottles from the day it was
 * built, while looking like stock that simply had not been matched yet.
 *
 * It had already been found and fixed in the LWIN controllers and not carried
 * across to the syncs, which is why this is a test rather than a comment.
 */
const CONTROLLERS = path.join(__dirname, '..', 'controller');

describe('owner matching never treats a NULL owner as a match', () => {
  const files = fs
    .readdirSync(CONTROLLERS)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(CONTROLLERS, name), 'utf8'),
    }))
    .filter(({ source }) => source.includes('POSITION('));

  it('finds the controllers that match on an owner name', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map(({ name }) => name))(
    '%s wraps every matched column in COALESCE',
    (name) => {
      const source = files.find((file) => file.name === name)!.source;
      const bare = [...source.matchAll(/UPPER\(\s*([a-z_]+\.[a-z_]+)\s*\)/g)];

      expect(
        bare.map((match) => match[1]),
        `${name} matches on a column that can be NULL without COALESCE, so rows with no owner match every owner`,
      ).toEqual([]);
    },
  );
});
