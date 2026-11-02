import { describe, expect, it } from 'vitest';

import type { ZohoSyncRecord } from './zohoSyncLog';
import { describeZohoSync, readZohoSync, zohoLineState } from './zohoSyncLog';

const record: ZohoSyncRecord = {
  total: 4,
  created: 1,
  updated: 0,
  exists: 1,
  skipped: 1,
  errors: 1,
  lines: [
    { itemId: 'a', productName: 'Margaux 2015', sku: '1-2015', status: 'created' },
    { itemId: 'b', productName: 'Palmer 2010', sku: '2-2010', status: 'exists' },
    { itemId: 'c', productName: 'Unmapped', sku: null, status: 'skipped' },
    { itemId: 'd', productName: 'Krug 2004', sku: '3-2004', status: 'error', error: 'Duplicate name' },
  ],
};

describe('zohoSyncLog', () => {
  it('summarises a sync for the activity log', () => {
    expect(describeZohoSync(record)).toBe(
      'Synced to Zoho: 2 of 4 lines (1 new, 1 unchanged), 1 failed, 1 skipped (no LWIN)',
    );
  });

  it('reads only zoho_sync rows with a record', () => {
    expect(readZohoSync('zoho_sync', { zohoSync: record })).toEqual(record);
    expect(readZohoSync('document_uploaded', { zohoSync: record })).toBeNull();
    expect(readZohoSync('zoho_sync', null)).toBeNull();
    expect(readZohoSync('zoho_sync', { zohoSync: { total: 1 } })).toBeNull();
  });

  it('places each line against the last sync', () => {
    expect(zohoLineState({ id: 'a', lwin: '1-2015' }, null)).toEqual({ kind: 'never' });
    expect(zohoLineState({ id: 'a', lwin: '1-2015' }, record)).toEqual({ kind: 'ok' });
    expect(zohoLineState({ id: 'a', lwin: '9-2015' }, record)).toEqual({ kind: 'changed' });
    expect(zohoLineState({ id: 'c', lwin: null }, record)).toEqual({ kind: 'skipped' });
    expect(zohoLineState({ id: 'c', lwin: '4-2019' }, record)).toEqual({ kind: 'changed' });
    expect(zohoLineState({ id: 'd', lwin: '3-2004' }, record)).toEqual({ kind: 'failed', error: 'Duplicate name' });
    expect(zohoLineState({ id: 'z', lwin: '5-2000' }, record)).toEqual({ kind: 'new' });
  });
});
