import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Every relative import in this module points at a file that exists.
 *
 * Five production deploys failed in a row on `Can't resolve './SalesUpload'` —
 * a component whose write never ran, imported by one whose write did. The build
 * catches it, but the build only runs on Vercel: SWC has no local binary for
 * this machine, so `next build` cannot be run here at all.
 *
 * That leaves a gap where a broken import reaches production unchallenged, and
 * costs a deploy cycle each time to discover. This closes it in the one place
 * that does run locally.
 */
const MODULE = path.join(__dirname, '..');

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry.name)) return [];

    return [full];
  });

const RELATIVE_IMPORT = /from\s+'(\.[^']+)'/g;

describe('every relative import resolves to a file', () => {
  const files = sourceFiles(MODULE);

  it('finds the module source', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((file) => path.relative(MODULE, file)))(
    '%s',
    (relative) => {
      const file = path.join(MODULE, relative);
      const source = fs.readFileSync(file, 'utf8');
      const missing: string[] = [];

      for (const match of source.matchAll(RELATIVE_IMPORT)) {
        const target = path.resolve(path.dirname(file), match[1]!);
        const found = ['.ts', '.tsx', '.json', '/index.ts', '/index.tsx'].some(
          (suffix) => fs.existsSync(`${target}${suffix}`),
        );

        if (!found && !fs.existsSync(target)) missing.push(match[1]!);
      }

      expect(missing, `${relative} imports files that do not exist`).toEqual([]);
    },
  );
});
