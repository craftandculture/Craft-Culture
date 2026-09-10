import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * A W code is Crurated's alone, so every other client's wines carry none.
 *
 * `tri_skus.w_code` is nullable and the seeder writes null for every wine it
 * creates from a document. Calling a string method on it therefore throws for
 * any client but Crurated — which took down the entire Reconciliation tab the
 * moment Cult Wines had one committed row, while every other tab kept working.
 *
 * The same nullability has now caused three faults: an editor that refused to
 * save, a column that rendered blank, and a screen that crashed outright. So
 * the rule is checked rather than remembered.
 */
const COMPONENTS = path.join(__dirname, '..', 'components');

/** `.length`, `.slice(`, `.toUpperCase(` … called straight off the field */
const UNGUARDED = /\.wCode\.\w+|\.lwin18\.\w+/g;

describe('a wine without a W code cannot crash a screen', () => {
  const files = fs
    .readdirSync(COMPONENTS)
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(COMPONENTS, name), 'utf8'),
    }));

  it.each(files.map(({ name }) => name))(
    '%s never calls a method on wCode or lwin18 directly',
    (name) => {
      const source = files.find((file) => file.name === name)!.source;
      /*
        Comments describe this very fault, and a guard that its own
        explanation trips is a guard nobody keeps. Only code is scanned.
      */
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      const hits = [...code.matchAll(UNGUARDED)].map((match) => match[0]);

      expect(
        hits,
        `${name} calls a method straight off a nullable code — it will throw for any client that is not Crurated`,
      ).toEqual([]);
    },
  );
});
