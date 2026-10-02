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
 * A labelled group inside the header panel
 *
 * @param props - Title and contents
 * @returns The group
 */
const Group = ({ title, children }: React.PropsWithChildren<{ title: string }>) => (
  <div className="space-y-2 border-t border-border-muted pt-4 first:border-t-0 first:pt-0">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{title}</p>
    {children}
  </div>
);

/**
 * The document's header and closing text, editable
 *
 * Pallets and weight are the figures the warehouse supplies; the consignee
 * block is what customs check against the importer's licence; the case count
 * can be set apart from the Qty column when customs ask for a different basis.
 * Each group is separated, and empty groups are hidden once issued.
 */
const ExportHeaderPanel = ({ document: doc, editable, onApply }: ExportHeaderPanelProps) => {
  const [note, setNote] = useState('');
  const [columnLabel, setColumnLabel] = useState('');
  const h = doc.header;

  const row = (label: string, node: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 rounded-md px-1 py-1 text-xs odd:bg-fill-muted/30">
      <span className="shrink-0 text-text-muted">{label}</span>
      <div className="min-w-0 max-w-[60%] flex-1">{node}</div>
    </div>
  );
  const input = 'min-w-0 flex-1 rounded-md border border-border-primary bg-fill-primary px-2 py-1.5 text-xs';

  return (
    <div className="space-y-4">
      <Group title="Shipment">
        <div className="space-y-0.5">
          {row('Date', <EditableText align="right" disabled={!editable} value={h.date} onSave={(v) => onApply([{ op: 'setHeader', field: 'date', value: v }], `Date: ${v}`)} />)}
          {row('Terms', <EditableText align="right" disabled={!editable} value={h.terms} onSave={(v) => onApply([{ op: 'setHeader', field: 'terms', value: v }], `Terms: ${v}`)} />)}
          {row('Pallets', <EditableText align="right" disabled={!editable} value={h.pallets === null ? '' : String(h.pallets)} placeholder="Enter" className={h.pallets === null ? 'text-text-warning' : ''} onSave={(v) => onApply([{ op: 'setHeader', field: 'pallets', value: toNumberOrNull(v) }], `Pallets: ${v}`)} />)}
          {row(
            h.grossWeightEstimated ? 'Gross weight (est.)' : 'Gross weight (weighed)',
            <EditableText align="right" disabled={!editable} value={h.grossWeightKg === null ? '' : `${h.grossWeightKg} kg`} placeholder="Enter kg" onSave={(v) => onApply([{ op: 'setHeader', field: 'grossWeightKg', value: toNumberOrNull(v) }], v ? `Gross weight: ${v} (weighed)` : 'Gross weight back to estimate')} />,
          )}
          {row('Cases declared', <EditableText align="right" disabled={!editable} value={h.casesOverride === null ? '' : String(h.casesOverride)} placeholder="= Qty column" onSave={(v) => onApply([{ op: 'setHeader', field: 'casesOverride', value: toNumberOrNull(v) }], v ? `Cases declared as ${v}` : 'Cases back to the Qty column')} />)}
        </div>
        {editable && h.grossWeightEstimated && (
          <p className="text-[11px] text-text-muted">Type the weighed figure to replace the estimate; clear it to go back.</p>
        )}
      </Group>

      <Group title="Consignee">
        <div className="space-y-1 rounded-lg border border-border-muted p-2.5 text-xs">
          <EditableText disabled={!editable} value={h.consignee.name} className="font-semibold" onSave={(v) => onApply([{ op: 'setConsignee', name: v }], `Consignee name: ${v}`)} />
          {editable ? (
            <EditableText value={h.consignee.addressLines.join(' / ')} onSave={(v) => onApply([{ op: 'setConsignee', addressLines: v.split('/').map((s) => s.trim()).filter(Boolean) }], 'Consignee address changed')} />
          ) : (
            <div className="px-1 text-text-muted">
              {h.consignee.addressLines.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1 px-1 text-text-muted">
            TRN
            <EditableText disabled={!editable} value={h.consignee.trn ?? ''} placeholder="Add" className="text-text-primary" onSave={(v) => onApply([{ op: 'setConsignee', trn: v || null }], `Consignee TRN: ${v}`)} />
          </div>
        </div>
        {editable && <p className="text-[11px] text-text-muted">Separate address lines with “/”.</p>}
      </Group>

      {(editable || doc.extraColumns.length > 0) && (
        <Group title="Extra columns">
          {doc.extraColumns.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {doc.extraColumns.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-border-muted bg-fill-muted/40 py-0.5 pl-2.5 pr-1 text-xs">
                  {c.label}
                  {editable && (
                    <button type="button" aria-label={`Remove ${c.label}`} className="rounded-full px-1.5 text-text-muted hover:bg-fill-muted hover:text-text-danger" onClick={() => onApply([{ op: 'removeColumn', key: c.key }], `Removed the ${c.label} column`)}>
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {editable && (
            <div className="flex gap-2">
              <input value={columnLabel} onChange={(e) => setColumnLabel(e.target.value)} placeholder="Column name, e.g. ABV" className={input} />
              <Button
                size="sm"
                variant="outline"
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
        </Group>
      )}

      {(editable || doc.notes.length > 0) && (
        <Group title="Notes on the document">
          {doc.notes.length > 0 && (
            <ul className="space-y-1.5">
              {doc.notes.map((n, i) => (
                <li key={`${n}-${i}`} className="flex items-start justify-between gap-2 rounded-lg border border-border-muted px-2.5 py-1.5 text-xs">
                  <span>{n}</span>
                  {editable && (
                    <button type="button" aria-label="Remove note" className="text-text-muted hover:text-text-danger" onClick={() => onApply([{ op: 'removeNote', index: i }], 'Removed a note')}>
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <div className="flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note customs asked for" className={input} />
              <Button size="sm" variant="outline" disabled={!note.trim()} onClick={() => { onApply([{ op: 'addNote', text: note.trim() }], `Note: ${note.trim()}`); setNote(''); }}>
                Add
              </Button>
            </div>
          )}
        </Group>
      )}

      <Group title="Declaration">
        <div className="rounded-lg border border-border-muted p-2.5 text-xs leading-relaxed">
          <EditableText disabled={!editable} value={doc.declaration} onSave={(v) => onApply([{ op: 'setDeclaration', text: v }], 'Declaration changed')} />
        </div>
      </Group>
    </div>
  );
};

export default ExportHeaderPanel;
