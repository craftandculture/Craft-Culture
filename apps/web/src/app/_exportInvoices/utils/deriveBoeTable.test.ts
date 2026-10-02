import { describe, expect, it } from 'vitest';

import deriveBoeTable from './deriveBoeTable';
import type { ExportDocument } from '../schemas/exportDocumentSchema';

const line = (id: string, boe: string | null, invoiceNumbers: string[]) =>
  ({ id, boe, source: { invoiceNumbers } }) as unknown as ExportDocument['lines'][number];

describe('deriveBoeTable', () => {
  it('groups lines by BOE and compresses invoice runs and line ranges', () => {
    const doc = {
      lines: [
        line('a', '1', ['INV-000366']),
        line('b', '2', ['INV-000348', 'INV-000350', 'INV-000351']),
        line('c', '2', ['INV-000352', 'INV-000365']),
        line('d', null, ['INV-000365']),
      ],
    } as unknown as ExportDocument;
    expect(deriveBoeTable(doc)).toEqual([
      { boe: '1', invoices: ['INV-000366'], lineRanges: '1' },
      { boe: '2', invoices: ['INV-000348', 'INV-000350–000352', 'INV-000365'], lineRanges: '2–3' },
      { boe: null, invoices: ['INV-000365'], lineRanges: '4' },
    ]);
  });
});
