'use client';

import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';

import EditableText from './EditableText';
import type { ExportDocument } from '../schemas/exportDocumentSchema';
import type { ExportOp } from '../schemas/exportOpSchema';

export interface ExportHeaderPanelProps {
  document: ExportDocument;
  editable: boolean;
  onApply: (ops: ExportOp[], summary: string) => void;
}

const toNumberOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[^\d.]/g, '')));

/**
 * The document's header and closing text, editable
 *
 * Pallets and weight are the figures the warehouse supplies; the consignee
 * block is what customs check against the importer's licence; the case count
 * can be set apart from the Qty column when customs ask for a different basis.
 */
const ExportHeaderPanel = ({ document: doc, editable, onApply }: ExportHeaderPanelProps) => {
  const [note, setNote] = useState('');
  const [columnLabel, setColumnLabel] = useState('');
  const h = doc.header;
  const field = (label: string, node: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 border-b border-border-muted/60 py-1 text-xs">
      <span className="text-text-muted">{label}</span>
      <div className="w-40">{node}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        {field('Date', <EditableText align="right" disabled={!editable} value={h.date} onSave={(v) => onApply([{ op: 'setHeader', field: 'date', value: v }], `Date: ${v}`)} />)}
        {field('Terms', <EditableText align="right" disabled={!editable} value={h.terms} onSave={(v) => onApply([{ op: 'setHeader', field: 'terms', value: v }], `Terms: ${v}`)} />)}
        {field('Pallets', <EditableText align="right" disabled={!editable} value={h.pallets === null ? '' : String(h.pallets)} placeholder="Enter" onSave={(v) => onApply([{ op: 'setHeader', field: 'pallets', value: toNumberOrNull(v) }], `Pallets: ${v}`)} />)}
        {field(
          h.grossWeightEstimated ? 'Gross weight (estimated)' : 'Gross weight (weighed)',
          <EditableText align="right" disabled={!editable} value={h.grossWeightKg === null ? '' : `${h.grossWeightKg}`} placeholder="Enter kg" onSave={(v) => onApply([{ op: 'setHeader', field: 'grossWeightKg', value: toNumberOrNull(v) }], v ? `Gross weight: ${v} kg (weighed)` : 'Gross weight back to estimate')} />,
        )}
        {field('Case count override', <EditableText align="right" disabled={!editable} value={h.casesOverride === null ? '' : String(h.casesOverride)} placeholder="Qty column" onSave={(v) => onApply([{ op: 'setHeader', field: 'casesOverride', value: toNumberOrNull(v) }], v ? `Cases declared as ${v}` : 'Cases back to the Qty column')} />)}
      </div>

      <div className="space-y-1 text-xs">
        <p className="font-semibold uppercase text-text-muted">Consignee</p>
        <EditableText disabled={!editable} value={h.consignee.name} onSave={(v) => onApply([{ op: 'setConsignee', name: v }], `Consignee name: ${v}`)} />
        <EditableText disabled={!editable} value={h.consignee.addressLines.join(' / ')} onSave={(v) => onApply([{ op: 'setConsignee', addressLines: v.split('/').map((s) => s.trim()).filter(Boolean) }], 'Consignee address changed')} />
        <EditableText disabled={!editable} value={h.consignee.trn ?? ''} placeholder="TRN" onSave={(v) => onApply([{ op: 'setConsignee', trn: v || null }], `Consignee TRN: ${v}`)} />
      </div>

      <div className="space-y-1 text-xs">
        <p className="font-semibold uppercase text-text-muted">Extra columns</p>
        {doc.extraColumns.map((c) => (
          <div key={c.key} className="flex items-center justify-between">
            <span>{c.label}</span>
            {editable && (
              <Button size="xs" variant="ghost" onClick={() => onApply([{ op: 'removeColumn', key: c.key }], `Removed the ${c.label} column`)}>
                Remove
              </Button>
            )}
          </div>
        ))}
        {editable && (
          <div className="flex gap-2">
            <input value={columnLabel} onChange={(e) => setColumnLabel(e.target.value)} placeholder="e.g. ABV" className="flex-1 rounded border border-border-primary bg-fill-primary px-2 py-1" />
            <Button
              size="xs"
              disabled={!columnLabel.trim()}
              onClick={() => {
                const label = columnLabel.trim();
                const key = label.toLowerCase().replace(/[^a-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : '')).replace(/^[^a-z]+/, '') || 'extra';
                onApply([{ op: 'addColumn', key, label }], `Added a ${label} column`);
                setColumnLabel('');
              }}
            >
              Add
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1 text-xs">
        <p className="font-semibold uppercase text-text-muted">Notes on the document</p>
        {doc.notes.map((n, i) => (
          <div key={`${n}-${i}`} className="flex items-start justify-between gap-2">
            <span>{n}</span>
            {editable && (
              <Button size="xs" variant="ghost" onClick={() => onApply([{ op: 'removeNote', index: i }], 'Removed a note')}>
                Remove
              </Button>
            )}
          </div>
        ))}
        {editable && (
          <div className="flex gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note customs asked for" className="flex-1 rounded border border-border-primary bg-fill-primary px-2 py-1" />
            <Button size="xs" disabled={!note.trim()} onClick={() => { onApply([{ op: 'addNote', text: note.trim() }], `Note: ${note.trim()}`); setNote(''); }}>
              Add
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1 text-xs">
        <p className="font-semibold uppercase text-text-muted">Declaration</p>
        <EditableText disabled={!editable} value={doc.declaration} onSave={(v) => onApply([{ op: 'setDeclaration', text: v }], 'Declaration changed')} />
      </div>
    </div>
  );
};

export default ExportHeaderPanel;
