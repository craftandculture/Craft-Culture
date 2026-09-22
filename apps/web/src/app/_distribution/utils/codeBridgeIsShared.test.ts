import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const CONTROLLERS = join(__dirname, '..', 'controller');

/**
 * The code bridge must have exactly one definition
 *
 * Their code reaching ours is the single most error-prone join in this module,
 * and it was written out twice before — the two copies disagreed, one of them
 * stopped one hop short, and every owner but Crurated showed a blank position
 * for weeks without anything looking broken.
 *
 * So the join lives in `codeBridge.ts` and controllers import it. A controller
 * that spells out the tables itself is how the two copies come back.
 */
const BRIDGE_JOIN = /\b(?:FROM|JOIN)\s+(?:tri_sku_aliases|wms_stock|cons_code_links)\b/;
const BRIDGE_CTE = /\b(?:code_map|outlet_code_map|confirmed_map)\s+AS\s*\(/;

/*
  Writing a link is not re-deriving one, and neither is naming a table in a
  comment — strip both before looking, or the guard cries wolf at the one
  controller whose whole job is to record a confirmation.
*/
const readsOnly = (source: string) =>
  source
    .replace(/DELETE\s+FROM/g, 'DELETE')
    .replace(/INSERT\s+INTO\s+\w+/g, 'INSERT')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*\*.*$/gm, '');

describe('the code bridge is defined once', () => {
  const files = readdirSync(CONTROLLERS).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
  );

  it.each(files)('%s does not re-derive the bridge', (name) => {
    const source = readFileSync(join(CONTROLLERS, name), 'utf8');

    const sql = readsOnly(source);

    if (!BRIDGE_JOIN.test(sql) && !BRIDGE_CTE.test(sql)) return;

    expect(
      source,
      `${name} joins the bridge tables directly. Import codeBridgeCtes / ` +
        'codeBridgeJoins / resolvedSnapshotCode from utils/codeBridge instead.',
    ).toMatch(/from '\.\.\/utils\/codeBridge'/);
  });
});
