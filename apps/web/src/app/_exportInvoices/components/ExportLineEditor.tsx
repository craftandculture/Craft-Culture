'use client';

import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';

import type { ExportLine } from '../schemas/exportDocumentSchema';
import type { ExportOp } from '../schemas/exportOpSchema';

export interface ExportLineEditorProps {
  line: ExportLine;
  currency: string;
  onApply: (ops: ExportOp[], summary: string) => void;
  onClose: () => void;
}

/**
 * The less common changes to one line, opened beneath it
 *
 * Choosing between candidate BOEs, and changing a price or quantity away from
 * the Zoho invoice. The latter needs a reason and stays flagged until Zoho is
 * reissued to match — the Giscours 6-pack priced as a 12 was this case.
 */
const ExportLineEditor = ({ line, currency, onApply, onClose }: ExportLineEditorProps) => {
  const [unitPrice, setUnitPrice] = useState(String(line.unitPrice));
  const [qty, setQty] = useState(String(line.qty));
  const [reason, setReason] = useState(line.override?.reason ?? '');

  const priceChanged = Number(unitPrice) !== line.unitPrice || Number(qty) !== line.qty;

  return (
    <div className="space-y-3 rounded-lg border border-border-muted bg-fill-muted/40 p-3 text-xs">
      {line.boeCandidates.length > 0 && (
        <div>
          <p className="mb-1 font-semibold">
            Stock Explorer holds this wine under more than one BOE. Which lot did it come from?
          </p>
          <div className="flex flex-wrap gap-2">
            {line.boeCandidates.map((c) => (
              <Button
                key={c.boe}
                size="xs"
                variant={line.boe === c.boe ? 'default' : 'outline'}
                colorRole={line.boe === c.boe ? 'brand' : 'primary'}
                onClick={() => onApply([{ op: 'setLineBoe', lineId: line.id, boe: c.boe }], `Line BOE set to ${c.boe}`)}
              >
                {c.boe} · {c.quantityCases} cs{c.ownerName ? ` · ${c.ownerName}` : ''}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1 font-semibold">Change price or quantity (differs from Zoho)</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            Unit price {currency}
            <input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-28 rounded border border-border-primary bg-fill-primary px-2 py-1" inputMode="decimal" />
          </label>
          <label className="flex flex-col gap-1">
            Qty
            <input value={qty} onChange={(e) => setQty(e.target.value)} className="w-16 rounded border border-border-primary bg-fill-primary px-2 py-1" inputMode="numeric" />
          </label>
          <label className="flex min-w-60 flex-1 flex-col gap-1">
            Reason (shown in the checks)
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Priced as a 12-pack; ships as a 6-pack" className="rounded border border-border-primary bg-fill-primary px-2 py-1" />
          </label>
          <Button
            size="sm"
            colorRole="brand"
            disabled={!priceChanged || reason.trim().length < 3 || Number.isNaN(Number(unitPrice))}
            onClick={() =>
              onApply(
                [{ op: 'overrideLine', lineId: line.id, unitPrice: Number(unitPrice), qty: Math.round(Number(qty)), reason: reason.trim() }],
                `Line changed from Zoho: ${reason.trim()}`,
              )
            }
          >
            Apply
          </Button>
          {line.override && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onApply(
                  [{ op: 'overrideLine', lineId: line.id, unitPrice: line.override?.originalUnitPrice, qty: line.override?.originalQty, reason: 'Restored to the Zoho invoice' }],
                  'Line restored to the Zoho invoice',
                )
              }
            >
              Restore Zoho figures
            </Button>
          )}
        </div>
      </div>

      {line.components.length > 0 && (
        <div>
          <p className="mb-1 font-semibold">In this case</p>
          <ul className="list-inside list-disc text-text-muted">
            {line.components.map((c, i) => (
              <li key={`${c.description}-${i}`}>
                {c.description} — {currency} {c.unitPrice.toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="xs" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};

export default ExportLineEditor;
