import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Procedures that write, and therefore must be told which client they are for.
 *
 * `resolveProgrammeId` falls back to Crurated when a request names no
 * programme. That default is right for a request that predates multi-client,
 * and silently wrong for a button on another client's tab: the work succeeds,
 * reports success, and lands in Crurated's reconciliation where the person who
 * pressed it is not looking.
 *
 * It has happened four times — the five live feeds, the SKU editor, the import
 * wizard and the period creator — each found only by someone noticing a screen
 * that should not have been empty. A read defaulting to Crurated shows the
 * wrong figures; a write defaulting to Crurated corrupts a second client's
 * data. So the writes are what this guards.
 */
const COMPONENTS = path.join(__dirname, '..', 'components');

/** Mutations whose controller scopes by programme */
const SCOPED_MUTATIONS = [
  'createImport',
  'createPeriod',
  'upsertSku',
  'syncCountFromWms',
  'syncCycleCountFromWms',
  'syncReceiptsFromWms',
  'syncSalesFromInvoices',
  'syncSalesFromZoho',
];

const sources = fs
  .readdirSync(COMPONENTS)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => ({
    name,
    source: fs.readFileSync(path.join(COMPONENTS, name), 'utf8'),
  }));

describe('every scoped mutation is told which client it is for', () => {
  it.each(SCOPED_MUTATIONS)('%s passes programmeId at every call site', (proc) => {
    const offenders: string[] = [];

    for (const { name, source } of sources) {
      /*
        The call and its argument object, up to the closing brace of that
        object. Matching a fixed number of lines would miss a long argument
        list and pass a call that never names the programme.
      */
      const pattern = new RegExp(`${proc}\\.mutate(?:Async)?\\(([\\s\\S]{0,600}?)\\)\\s*[;,.]`, 'g');

      for (const match of source.matchAll(pattern)) {
        const args = match[1] ?? '';

        if (!args.includes('programmeId')) {
          offenders.push(`${name}: ${proc}.mutate(${args.slice(0, 60).trim()}…)`);
        }
      }
    }

    expect(
      offenders,
      `these call sites let the server default to Crurated, so the work lands in the wrong client`,
    ).toEqual([]);
  });
});
