'use client';

import { Fragment, useState } from 'react';

import EditableText from './EditableText';
import ExportLineEditor from './ExportLineEditor';
import type { ExportDocument } from '../schemas/exportDocumentSchema';
import type { ExportOp } from '../schemas/exportOpSchema';
import deriveBoeTable from '../utils/deriveBoeTable';
import deriveDocumentTotals from '../utils/deriveDocumentTotals';
import formatSectionTitle from '../utils/formatSectionTitle';

export interface ExportDocumentPreviewProps {
  document: ExportDocument;
  editable: boolean;
  highlighted: string[];
  onApply: (ops: ExportOp[], summary: string) => void;
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/**
 * The export invoice on screen, editable in place
 *
 * Laid out like the PDF so what is checked is what is printed. Description,
 * HS code, origin, pack and BOE are edited by clicking them; price and
 * quantity, which must agree with Zoho, are changed from the line's own panel.
 */
const ExportDocumentPreview = ({ document: doc, editable, highlighted, onApply }: ExportDocumentPreviewProps) => {
  const [openLine, setOpenLine] = useState<string | null>(null);
  const totals = deriveDocumentTotals(doc);
  const boes = deriveBoeTable(doc);
  const cur = doc.header.currency;
  const colCount = 10 + doc.extraColumns.length;
  // Lines are stored in print order, so the index is the printed line number
  const lineNumber = new Map(doc.lines.map((l, i) => [l.id, i + 1]));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border-muted">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="bg-fill-bold text-left text-[10px] uppercase tracking-wide text-text-bold-on-fill">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Description of goods</th>
              <th className="px-2 py-1.5">HS code</th>
              <th className="px-2 py-1.5">Origin</th>
              <th className="px-2 py-1.5">Pack</th>
              <th className="px-2 py-1.5 text-center">Qty</th>
              <th className="px-2 py-1.5 text-center">Bottles</th>
              {doc.extraColumns.map((c) => (
                <th key={c.key} className="px-2 py-1.5">{c.label}</th>
              ))}
              <th className="px-2 py-1.5">BOE</th>
              <th className="px-2 py-1.5 text-right">Unit {cur}</th>
              <th className="px-2 py-1.5 text-right">Amount {cur}</th>
            </tr>
          </thead>
          <tbody>
            {doc.sections.map((section) => (
              <Fragment key={section.id}>
                <tr>
                  <td colSpan={colCount} className="bg-[#2a5a4a] px-2 py-1 text-[11px] font-semibold text-white">
                    {formatSectionTitle(section)}
                  </td>
                </tr>
                {doc.lines
                  .filter((l) => l.sectionId === section.id)
                  .map((l) => {
                    const rowNo = lineNumber.get(l.id) ?? 0;
                    const set = (field: 'description' | 'hsCode' | 'origin', label: string) => (v: string) =>
                      onApply([{ op: 'setLine', lineId: l.id, field, value: v }], `Line ${rowNo} ${label}: ${v}`);
                    return (
                      <Fragment key={l.id}>
                        <tr className={`border-b border-border-muted/60 ${highlighted.includes(l.id) ? 'bg-fill-warning/15' : ''} ${l.override ? 'bg-fill-warning/5' : ''}`}>
                          <td className="px-2 py-0.5 text-text-muted">
                            {editable ? (
                              <button type="button" className="hover:text-text-brand" onClick={() => setOpenLine(openLine === l.id ? null : l.id)} title="More changes to this line">
                                {rowNo} ⋯
                              </button>
                            ) : (
                              rowNo
                            )}
                          </td>
                          <td className="px-1 py-0.5"><EditableText value={l.description} disabled={!editable} onSave={set('description', 'description')} /></td>
                          <td className="w-24 px-1 py-0.5"><EditableText value={l.hsCode} disabled={!editable} onSave={set('hsCode', 'HS code')} /></td>
                          <td className="w-28 px-1 py-0.5"><EditableText value={l.origin} disabled={!editable} onSave={set('origin', 'origin')} placeholder="Add origin" /></td>
                          <td className="w-20 px-1 py-0.5">
                            <EditableText
                              value={`${l.packBottles}x${l.bottleSizeCl}cl`}
                              disabled={!editable || l.kind === 'mixedCase'}
                              onSave={(v) => {
                                const m = v.match(/^(\d+)\s*x\s*(\d+)\s*cl$/i);
                                if (!m) return;
                                const ops: ExportOp[] = [
                                  { op: 'setLine', lineId: l.id, field: 'packBottles', value: Number(m[1]) },
                                  { op: 'setLine', lineId: l.id, field: 'bottleSizeCl', value: Number(m[2]) },
                                ];
                                onApply(ops, `Line ${rowNo} pack: ${v}`);
                              }}
                            />
                          </td>
                          <td className="px-2 py-0.5 text-center">{l.qty}</td>
                          <td className="px-2 py-0.5 text-center">{l.qty * l.packBottles}</td>
                          {doc.extraColumns.map((c) => (
                            <td key={c.key} className="w-20 px-1 py-0.5">
                              <EditableText
                                value={l.extra[c.key] ?? ''}
                                disabled={!editable}
                                onSave={(v) => onApply([{ op: 'setColumnValues', key: c.key, values: [{ lineId: l.id, value: v }] }], `Line ${rowNo} ${c.label}: ${v}`)}
                              />
                            </td>
                          ))}
                          <td className="w-32 px-1 py-0.5">
                            <EditableText
                              value={l.boe ?? ''}
                              disabled={!editable}
                              placeholder={l.boeCandidates.length ? 'Choose ⋯' : 'Missing'}
                              className={l.boe ? '' : 'text-text-danger'}
                              onSave={(v) => onApply([{ op: 'setLineBoe', lineId: l.id, boe: v || null }], `Line ${rowNo} BOE: ${v}`)}
                            />
                          </td>
                          <td className="px-2 py-0.5 text-right">{money(l.unitPrice)}</td>
                          <td className="px-2 py-0.5 text-right">{money(l.amount)}</td>
                        </tr>
                        {openLine === l.id && (
                          <tr>
                            <td colSpan={colCount} className="p-2">
                              <ExportLineEditor line={l} currency={cur} onApply={onApply} onClose={() => setOpenLine(null)} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        <div className="rounded-lg border border-border-muted bg-fill-muted/30 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase">Re-export bill of entry references</p>
          <table className="w-full text-xs">
            <thead className="text-left text-text-muted">
              <tr><th className="py-1">BOE</th><th>Source invoice</th><th>Lines</th></tr>
            </thead>
            <tbody>
              {boes.map((b) => (
                <tr key={b.boe ?? 'none'} className="border-t border-border-muted/60">
                  <td className={`py-1 ${b.boe ? '' : 'text-text-danger'}`}>{b.boe ?? 'Missing'}</td>
                  <td>{b.invoices.join(', ')}</td>
                  <td>{b.lineRanges}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between border-b border-border-muted py-1"><span>Cases</span><span>{totals.declaredCases}</span></div>
          <div className="flex justify-between border-b border-border-muted py-1"><span>Bottles</span><span>{totals.bottles}</span></div>
          <div className="flex justify-between border-b border-border-muted py-1 text-text-muted"><span>Invoices (USD)</span><span>{money(totals.invoicesUsd)}</span></div>
          <div className="flex justify-between pt-2 text-lg font-semibold"><span>Total</span><span>{cur} {money(totals.total)}</span></div>
        </div>
      </div>
    </div>
  );
};

export default ExportDocumentPreview;
