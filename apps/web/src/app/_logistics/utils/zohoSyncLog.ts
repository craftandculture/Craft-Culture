/**
 * Zoho sync history for a shipment
 *
 * Each press of "Sync to Zoho" writes one row to the shipment's activity log
 * with the outcome of every line in its metadata. The server writes it and
 * the shipment page reads it back through these helpers, so the two always
 * agree on its shape.
 */

export const ZOHO_SYNC_ACTION = 'zoho_sync';

export type ZohoSyncLineStatus = 'created' | 'updated' | 'exists' | 'skipped' | 'error';

export interface ZohoSyncLine {
  itemId: string;
  productName: string;
  sku: string | null;
  status: ZohoSyncLineStatus;
  zohoItemId?: string;
  error?: string;
}

export interface ZohoSyncRecord {
  total: number;
  created: number;
  updated: number;
  exists: number;
  skipped: number;
  errors: number;
  lines: ZohoSyncLine[];
}

/** Lines that reached Zoho, whether new, changed or already there */
export const zohoSyncedCount = (record: ZohoSyncRecord) =>
  record.created + record.updated + record.exists;

/** One-line summary for the activity log, e.g. "Synced to Zoho: 17 of 18 lines (3 new, 14 unchanged), 1 failed" */
export const describeZohoSync = (record: ZohoSyncRecord) => {
  const detail = [
    record.created ? `${record.created} new` : null,
    record.updated ? `${record.updated} updated` : null,
    record.exists ? `${record.exists} unchanged` : null,
  ].filter(Boolean);
  const problems = [
    record.errors ? `${record.errors} failed` : null,
    record.skipped ? `${record.skipped} skipped (no LWIN)` : null,
  ].filter(Boolean);

  return [
    `Synced to Zoho: ${zohoSyncedCount(record)} of ${record.total} lines${detail.length ? ` (${detail.join(', ')})` : ''}`,
    ...problems,
  ].join(', ');
};

/** The sync record in an activity log row's metadata, or null for any other row */
export const readZohoSync = (action: string, metadata: unknown): ZohoSyncRecord | null => {
  if (action !== ZOHO_SYNC_ACTION || !metadata || typeof metadata !== 'object') return null;
  const record = (metadata as { zohoSync?: unknown }).zohoSync;
  if (!record || typeof record !== 'object' || !Array.isArray((record as ZohoSyncRecord).lines)) {
    return null;
  }
  return record as ZohoSyncRecord;
};

export type ZohoLineState =
  | { kind: 'ok' }
  | { kind: 'never' }
  | { kind: 'failed'; error: string }
  | { kind: 'skipped' }
  | { kind: 'changed' }
  | { kind: 'new' };

/**
 * Where one shipment line stands against the last sync.
 *
 * 'never' when the shipment has not been synced at all; 'new' when the line
 * was added after the last sync; 'changed' when its LWIN was changed since, so
 * Zoho holds the old code.
 */
export const zohoLineState = (
  item: { id: string; lwin: string | null },
  lastSync: ZohoSyncRecord | null,
): ZohoLineState => {
  if (!lastSync) return { kind: 'never' };
  const line = lastSync.lines.find((l) => l.itemId === item.id);
  if (!line) return { kind: 'new' };
  if (line.status === 'error') return { kind: 'failed', error: line.error ?? 'Unknown error' };
  if (line.status === 'skipped') return item.lwin ? { kind: 'changed' } : { kind: 'skipped' };
  if ((line.sku ?? null) !== (item.lwin ?? null)) return { kind: 'changed' };
  return { kind: 'ok' };
};
