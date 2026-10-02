'use client';

import { Fragment, useEffect, useState } from 'react';

import EditableText from './EditableText';
import ExportLineEditor from './ExportLineEditor';
import type { ExportDocument, ExportLine } from '../schemas/exportDocumentSchema';
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
 * A line's description, with a mixed case shown as its wines
 *
 * @param line - The line
 * @returns The title and, for a mixed case, the wines in it
 */
const describe = (line: ExportLine) =>
  line.kind === 'mixedCase'
    ? { title: `Mixed case of ${line.packBottles} × ${line.bottleSizeCl}cl — contents below`, wines: line.components.map((c) => c.description) }
    : { title: line.description, wines: [] as string[] };

/**
 * The export invoice on screen, editable in place
 *
 * A table on wide screens and one card per line on a phone. Description, HS
 * code, origin, pack and BOE are edited by tapping them; price and quantity,
 * which must agree with Zoho, are changed from the line's own panel. A check
 * that names lines scrolls to the first of them.
 */
const ExportDocumentPreview = ({ document: doc, editable, highlighted, onApply }: ExportDocumentPreviewProps) => {
  const [openLine, setOpenLine] = useState<string | null>(null);
  const totals = deriveDocumentTotals(doc);
  const boes = deriveBoeTable(doc);
  const cur = doc.header.currency;
  const colCount = (editable ? 9 : 8) + doc.extraColumns.length;
  // Lines are stored in print order, so the index is the printed line number
  const lineNumber = new Map(doc.lines.map((l, i) => [l.id, i + 1]));

  useEffect(() => {
    const first = highlighted[0];
    if (!first) return;
    globalThis.document
      ?.querySelector(`[data-line="${first}"]:not([hidden])`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlighted]);

  const setField = (l: ExportLine, field: 'description' | 'hsCode' | 'origin', label: string) => (v: string) =>
    onApply([{ op: 'setLine', lineId: l.id, field, value: v }], `Line ${lineNumber.get(l.id)} ${label}: ${v}`);
  const setPack = (l: ExportLine) => (v: string) => {
    const m = v.match(/^(\d+)\s*x\s*(\d+)\s*(?:cl)?$/i);
    if (!m) return;
    onApply(
      [
        { op: 'setLine', lineId: l.id, field: 'packBottles', value: Number(m[1]) },
        { op: 'setLine', lineId: l.id, field: 'bottleSizeCl', value: Number(m[2]) },
      ],
      `Line ${lineNumber.get(l.id)} pack: ${v}`,
    );
  };
  const setComponent = (l: ExportLine, index: number, field: 'description' | 'origin' | 'hsCode') => (v: string) =>
    onApply(
      [{ op: 'setComponent', lineId: l.id, index, field, value: v }],
      `Line ${lineNumber.get(l.id)}.${index + 1} ${field === 'hsCode' ? 'HS code' : field}: ${v}`,
    );
  const setBoe = (l: ExportLine) => (v: string) =>
    onApply([{ op: 'setLineBoe', lineId: l.id, boe: v || null }], `Line ${lineNumber.get(l.id)} BOE: ${v}`);
  const rowTone = (l: ExportLine) =>
    highlighted.includes(l.id) ? 'bg-fill-warning/15' : l.override ? 'bg-fill-warning/5' : '';
  const toggle = (l: ExportLine) => setOpenLine(openLine === l.id ? null : l.id);

  const lineButton = (l: ExportLine) =>
    editable && (
      <button
        type="button"
        onClick={() => toggle(l)}
        className={`rounded px-2 py-1 text-[11px] font-medium ${
          openLine === l.id ? 'bg-fill-brand/15 text-text-brand' : 'text-text-muted hover:bg-fill-muted'
        } ${!l.boe && l.boeCandidates.length ? 'text-text-danger' : ''}`}
      >
        {!l.boe && l.boeCandidates.length ? 'Choose BOE' : openLine === l.id ? 'Close' : 'More'}
      </button>
    );

  return (
    <div className="space-y-4">
      {/* Wide screens: the table, laid out like the PDF */}
      <div className="hidden overflow-x-auto rounded-xl border border-border-muted bg-fill-primary lg:block">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-fill-bold text-left text-[10px] uppercase tracking-wide text-text-bold-on-fill">
            <tr>
              <th className="w-8 px-2 py-2">#</th>
              <th className="min-w-[240px] px-2 py-2">Description of goods</th>
              <th className="w-24 px-2 py-2">HS / Origin</th>
              <th className="w-20 px-2 py-2">Pack</th>
              <th className="w-20 px-2 py-2 text-center">Qty · Btl</th>
              {doc.extraColumns.map((c) => (
                <th key={c.key} className="w-20 px-2 py-2">{c.label}</th>
              ))}
              <th className="w-32 px-2 py-2">BOE</th>
              <th className="w-24 px-2 py-2 text-right">Unit {cur}</th>
              <th className="w-28 px-2 py-2 text-right">Amount {cur}</th>
              {editable && <th className="w-16 px-2 py-2" />}
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
                    const d = describe(l);
                    return (
                      <Fragment key={l.id}>
                        <tr data-line={l.id} className={`border-b border-border-muted align-top transition-colors ${rowTone(l) || 'hover:bg-fill-muted/25'}`}>
                          <td className="px-2 py-1 text-text-muted">{lineNumber.get(l.id)}</td>
                          <td className="px-1 py-1">
                            {l.kind === 'mixedCase' ? (
                              <p className="px-1 font-medium">{d.title}</p>
                            ) : (
                              <EditableText value={l.description} disabled={!editable} onSave={setField(l, 'description', 'description')} />
                            )}
                            {l.override && <p className="px-1 text-[10px] text-text-warning">Differs from Zoho: {l.override.reason}</p>}
                          </td>
                          <td className="px-1 py-1">
                            {l.kind !== 'mixedCase' && (
                              <>
                                <EditableText value={l.hsCode} disabled={!editable} onSave={setField(l, 'hsCode', 'HS code')} />
                                <EditableText value={l.origin} disabled={!editable} onSave={setField(l, 'origin', 'origin')} placeholder="Add origin" className={l.origin ? 'text-text-muted' : 'text-text-warning'} />
                              </>
                            )}
                          </td>
                          <td className="px-1 py-1">
                            <EditableText value={`${l.packBottles}x${l.bottleSizeCl}cl`} disabled={!editable || l.kind === 'mixedCase'} onSave={setPack(l)} />
                          </td>
                          <td className="px-2 py-1 text-center tabular-nums">
                            {l.qty} <span className="text-text-muted">· {l.qty * l.packBottles}</span>
                          </td>
                          {doc.extraColumns.map((c) => (
                            <td key={c.key} className="px-1 py-1">
                              <EditableText
                                value={l.extra[c.key] ?? ''}
                                disabled={!editable}
                                onSave={(v) => onApply([{ op: 'setColumnValues', key: c.key, values: [{ lineId: l.id, value: v }] }], `Line ${lineNumber.get(l.id)} ${c.label}: ${v}`)}
                              />
                            </td>
                          ))}
                          <td className="px-1 py-1">
                            <EditableText
                              value={l.boe ?? ''}
                              disabled={!editable}
                              placeholder={l.boeCandidates.length ? 'Choose' : 'Missing'}
                              className={`font-mono text-[11px] ${l.boe ? '' : 'text-text-danger'}`}
                              onSave={setBoe(l)}
                            />
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums">{l.kind === 'mixedCase' ? '' : money(l.unitPrice)}</td>
                          <td className="px-2 py-1 text-right font-medium tabular-nums">
                            {l.kind === 'mixedCase' ? <span className="text-text-muted">{money(l.amount)}</span> : money(l.amount)}
                          </td>
                          {editable && <td className="px-1 py-1 text-right">{lineButton(l)}</td>}
                        </tr>
                        {l.kind === 'mixedCase' &&
                          l.components.map((c, i) => (
                            <tr key={`${l.id}-${i}`} className="border-b border-border-muted/50 bg-fill-muted/15 align-top">
                              <td className="px-2 py-1 text-[11px] text-text-muted">{lineNumber.get(l.id)}.{i + 1}</td>
                              <td className="py-1 pl-5 pr-1">
                                <EditableText value={c.description} disabled={!editable} onSave={setComponent(l, i, 'description')} />
                              </td>
                              <td className="px-1 py-1">
                                <EditableText value={c.hsCode ?? l.hsCode} disabled={!editable} onSave={setComponent(l, i, 'hsCode')} />
                                <EditableText value={c.origin} disabled={!editable} onSave={setComponent(l, i, 'origin')} placeholder="Add origin" className={c.origin ? 'text-text-muted' : 'text-text-warning'} />
                              </td>
                              <td className="px-2 py-1 text-text-muted">1x{l.bottleSizeCl}cl</td>
                              <td className="px-2 py-1 text-center tabular-nums text-text-muted">{l.qty} btl</td>
                              {doc.extraColumns.map((x) => (
                                <td key={x.key} />
                              ))}
                              <td />
                              <td className="px-2 py-1 text-right tabular-nums">{money(c.unitPrice)}</td>
                              <td className="px-2 py-1 text-right tabular-nums">{money(c.unitPrice * l.qty)}</td>
                              {editable && <td />}
                            </tr>
                          ))}
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

      {/* Phones and tablets: one card per line */}
      <div className="space-y-3 lg:hidden">
        {doc.sections.map((section) => (
          <div key={section.id} className="overflow-hidden rounded-xl border border-border-muted bg-fill-primary">
            <p className="bg-[#2a5a4a] px-3 py-1.5 text-[11px] font-semibold text-white">{formatSectionTitle(section)}</p>
            <ul className="divide-y divide-border-muted/60">
              {doc.lines
                .filter((l) => l.sectionId === section.id)
                .map((l) => {
                  const d = describe(l);
                  return (
                    <li key={l.id} data-line={l.id} className={`space-y-1.5 px-3 py-2.5 text-xs ${rowTone(l)}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="mr-1 text-text-muted">{lineNumber.get(l.id)}.</span>
                          {l.kind === 'mixedCase' ? (
                            <span className="font-medium">{d.title}</span>
                          ) : (
                            <EditableText value={l.description} disabled={!editable} onSave={setField(l, 'description', 'description')} className="font-medium" />
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">{cur} {money(l.amount)}</p>
                          <p className="text-[11px] text-text-muted tabular-nums">
                            {l.qty} × {money(l.unitPrice)}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] sm:grid-cols-4">
                        <label className="flex items-center gap-1 text-text-muted">Pack
                          <EditableText value={`${l.packBottles}x${l.bottleSizeCl}cl`} disabled={!editable || l.kind === 'mixedCase'} onSave={setPack(l)} className="text-text-primary" />
                        </label>
                        <span className="flex items-center text-text-muted">Bottles <span className="ml-1 text-text-primary">{l.qty * l.packBottles}</span></span>
                        {l.kind !== 'mixedCase' && (
                          <>
                            <label className="flex items-center gap-1 text-text-muted">HS
                              <EditableText value={l.hsCode} disabled={!editable} onSave={setField(l, 'hsCode', 'HS code')} className="text-text-primary" />
                            </label>
                            <label className="flex items-center gap-1 text-text-muted">Origin
                              <EditableText value={l.origin} disabled={!editable} onSave={setField(l, 'origin', 'origin')} placeholder="Add" className={l.origin ? 'text-text-primary' : 'text-text-warning'} />
                            </label>
                          </>
                        )}
                        <label className="col-span-2 flex items-center gap-1 text-text-muted">BOE
                          <EditableText value={l.boe ?? ''} disabled={!editable} placeholder={l.boeCandidates.length ? 'Choose' : 'Missing'} onSave={setBoe(l)} className={`font-mono ${l.boe ? 'text-text-primary' : 'text-text-danger'}`} />
                        </label>
                        {doc.extraColumns.map((c) => (
                          <label key={c.key} className="flex items-center gap-1 text-text-muted">{c.label}
                            <EditableText value={l.extra[c.key] ?? ''} disabled={!editable} onSave={(v) => onApply([{ op: 'setColumnValues', key: c.key, values: [{ lineId: l.id, value: v }] }], `Line ${lineNumber.get(l.id)} ${c.label}: ${v}`)} className="text-text-primary" />
                          </label>
                        ))}
                      </div>
                      {l.kind === 'mixedCase' && (
                        <ul className="space-y-1 rounded-lg border border-border-muted/70 bg-fill-muted/20 p-2">
                          {l.components.map((c, i) => (
                            <li key={`${l.id}-${i}`} className="text-[11px]">
                              <div className="flex justify-between gap-2">
                                <EditableText value={c.description} disabled={!editable} onSave={setComponent(l, i, 'description')} />
                                <span className="shrink-0 tabular-nums">{money(c.unitPrice * l.qty)}</span>
                              </div>
                              <div className="flex gap-3 text-text-muted">
                                <label className="flex items-center gap-1">Origin
                                  <EditableText value={c.origin} disabled={!editable} onSave={setComponent(l, i, 'origin')} placeholder="Add" className={c.origin ? 'text-text-primary' : 'text-text-warning'} />
                                </label>
                                <label className="flex items-center gap-1">HS
                                  <EditableText value={c.hsCode ?? l.hsCode} disabled={!editable} onSave={setComponent(l, i, 'hsCode')} className="text-text-primary" />
                                </label>
                                <span className="flex items-center">{l.qty} btl</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      {l.override && <p className="text-[10px] text-text-warning">Differs from Zoho: {l.override.reason}</p>}
                      {editable && <div className="flex justify-end">{lineButton(l)}</div>}
                      {openLine === l.id && (
                        <ExportLineEditor line={l} currency={cur} onApply={onApply} onClose={() => setOpenLine(null)} />
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        <div className="rounded-xl border border-border-muted bg-fill-primary p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase">Re-export bill of entry references</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-text-muted">
                <tr><th className="py-1 pr-2">BOE</th><th className="pr-2">Source invoice</th><th>Lines</th></tr>
              </thead>
              <tbody>
                {boes.map((b) => (
                  <tr key={b.boe ?? 'none'} className="border-t border-border-muted/60 align-top">
                    <td className={`py-1 pr-2 font-mono ${b.boe ? '' : 'text-text-danger'}`}>{b.boe ?? 'Missing'}</td>
                    <td className="pr-2">{b.invoices.join(', ')}</td>
                    <td>{b.lineRanges}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-1 self-start rounded-xl border border-border-muted bg-fill-primary p-4 text-sm">
          <div className="flex justify-between border-b border-border-muted py-1"><span>Cases</span><span className="tabular-nums">{totals.declaredCases}</span></div>
          <div className="flex justify-between border-b border-border-muted py-1"><span>Bottles</span><span className="tabular-nums">{totals.bottles}</span></div>
          <div className="flex justify-between border-b border-border-muted py-1 text-text-muted"><span>Invoices (USD)</span><span className="tabular-nums">{money(totals.invoicesUsd)}</span></div>
          <div className="flex justify-between pt-2 text-lg font-semibold"><span>Total</span><span className="tabular-nums">{cur} {money(totals.total)}</span></div>
        </div>
      </div>
    </div>
  );
};

export default ExportDocumentPreview;
