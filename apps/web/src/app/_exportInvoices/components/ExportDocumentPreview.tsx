'use client';

import { Fragment, useEffect, useState } from 'react';

import EditableText from './EditableText';
import ExportLineEditor from './ExportLineEditor';
import HsCodeSelect from './HsCodeSelect';
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
  const colCount = (editable ? 12 : 11) + doc.extraColumns.length;
  // Lines are stored in print order, so the index is the printed line number
  const lineNumber = new Map(doc.lines.map((l, i) => [l.id, i + 1]));

  useEffect(() => {
    const first = highlighted[0];
    if (!first) return;
    globalThis.document
      ?.querySelector(`[data-line="${first}"]:not([hidden])`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlighted]);

  const sectionTotals = (sectionId: string) => {
    const lines = doc.lines.filter((l) => l.sectionId === sectionId);
    return { lines: lines.length, amount: lines.reduce((sum, l) => sum + l.amount, 0) };
  };
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
        className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
          !l.boe && l.boeCandidates.length
            ? 'border-border-danger/40 bg-fill-danger/10 text-text-danger'
            : openLine === l.id
              ? 'border-border-brand bg-fill-brand/15 text-text-brand'
              : 'border-border-muted text-text-muted hover:border-border-primary hover:text-text-primary'
        }`}
      >
        {!l.boe && l.boeCandidates.length ? 'Choose BOE' : openLine === l.id ? 'Close' : 'Edit line'}
      </button>
    );

  return (
    <div className="space-y-4">
      {doc.sections.length > 2 && (
        <nav aria-label="Sections" className="flex gap-1.5 overflow-x-auto pb-1">
          {doc.sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() =>
                globalThis.document
                  ?.querySelector(`[data-section="${section.id}"]:not([hidden])`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="shrink-0 rounded-full border border-border-muted bg-fill-primary px-3 py-1 text-[11px] font-medium text-text-muted hover:border-border-brand hover:text-text-primary"
            >
              {section.refs.length > 1 ? `${section.refs[0]?.invoiceNumber} +${section.refs.length - 1}` : section.refs[0]?.invoiceNumber}
              <span className="ml-1.5 tabular-nums text-text-muted">{sectionTotals(section.id).lines}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Wide screens: the table, laid out like the PDF */}
      <div className="hidden overflow-x-auto rounded-xl border border-border-muted bg-fill-primary lg:block">
        <table className="w-full text-xs">
          <thead className="bg-fill-bold text-left text-[10px] uppercase tracking-wide text-text-bold-on-fill">
            <tr>
              <th className="w-10 px-3 py-2.5">#</th>
              <th className="min-w-[260px] px-2 py-2.5">Description of goods</th>
              <th className="w-32 px-2 py-2.5">HS code</th>
              <th className="w-28 px-2 py-2.5">Origin</th>
              <th className="w-20 px-2 py-2.5">Pack</th>
              <th className="w-12 px-2 py-2.5 text-right">Qty</th>
              <th className="w-16 px-2 py-2.5 text-right">Bottles</th>
              {doc.extraColumns.map((c) => (
                <th key={c.key} className="w-20 px-2 py-2.5">{c.label}</th>
              ))}
              <th className="w-32 px-2 py-2.5">BOE</th>
              <th className="w-24 px-2 py-2.5 text-right">Unit {cur}</th>
              <th className="w-28 px-3 py-2.5 text-right">Amount {cur}</th>
              {editable && <th className="w-20 px-2 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {doc.sections.map((section) => (
              <Fragment key={section.id}>
                <tr data-section={section.id} className="scroll-mt-24">
                  <td colSpan={colCount} className="bg-[#2a5a4a] px-3 py-1.5 text-[11px] font-semibold text-white">
                    <div className="flex items-center justify-between gap-4">
                      <span>{formatSectionTitle(section)}</span>
                      <span className="shrink-0 font-normal text-white/80 tabular-nums">
                        {sectionTotals(section.id).lines} line{sectionTotals(section.id).lines === 1 ? '' : 's'} · {cur} {money(sectionTotals(section.id).amount)}
                      </span>
                    </div>
                  </td>
                </tr>
                {doc.lines
                  .filter((l) => l.sectionId === section.id)
                  .map((l, rowIndex, sectionLines) => {
                    const mixed = l.kind === 'mixedCase';
                    // Show the BOE only where it changes; the table below lists it in full
                    const sameBoe = rowIndex > 0 && sectionLines[rowIndex - 1]?.boe === l.boe && Boolean(l.boe);
                    const zebra = rowIndex % 2 === 1 ? 'bg-fill-muted/15' : '';
                    return (
                      <Fragment key={l.id}>
                        <tr
                          data-line={l.id}
                          className={`border-b border-border-muted align-middle transition-colors ${
                            rowTone(l) || (mixed ? 'bg-fill-muted/35' : `${zebra} hover:bg-fill-muted/30`)
                          }`}
                        >
                          <td className="px-3 py-1.5 font-medium text-text-muted">{lineNumber.get(l.id)}</td>
                          <td className="px-1 py-1.5">
                            {mixed ? (
                              <p className="px-1">
                                <span className="font-semibold">Mixed case of {l.packBottles} × {l.bottleSizeCl}cl</span>
                                <span className="ml-2 text-text-muted">
                                  {l.qty > 1 ? `${l.qty} cases · ` : ''}case total {cur} {money(l.amount)}
                                </span>
                              </p>
                            ) : (
                              <EditableText value={l.description} disabled={!editable} onSave={setField(l, 'description', 'description')} />
                            )}
                            {l.override && <p className="px-1 text-[10px] text-text-warning">Differs from Zoho: {l.override.reason}</p>}
                          </td>
                          <td className="px-1 py-1.5">
                            {!mixed && <HsCodeSelect value={l.hsCode} disabled={!editable} onSave={setField(l, 'hsCode', 'HS code')} />}
                          </td>
                          <td className="px-1 py-1.5">
                            {!mixed && (
                              <EditableText value={l.origin} disabled={!editable} onSave={setField(l, 'origin', 'origin')} placeholder="Add origin" className={l.origin ? '' : 'text-text-warning'} />
                            )}
                          </td>
                          <td className="px-1 py-1.5">
                            <EditableText value={`${l.packBottles}x${l.bottleSizeCl}cl`} disabled={!editable || mixed} onSave={setPack(l)} />
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium tabular-nums">{l.qty}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{l.qty * l.packBottles}</td>
                          {doc.extraColumns.map((c) => (
                            <td key={c.key} className="px-1 py-1.5">
                              <EditableText
                                value={l.extra[c.key] ?? ''}
                                disabled={!editable}
                                onSave={(v) => onApply([{ op: 'setColumnValues', key: c.key, values: [{ lineId: l.id, value: v }] }], `Line ${lineNumber.get(l.id)} ${c.label}: ${v}`)}
                              />
                            </td>
                          ))}
                          <td className="px-1 py-1.5">
                            {sameBoe && !editable ? (
                              <span className="px-1 text-text-muted" title={l.boe ?? ''}>〃</span>
                            ) : (
                              <EditableText
                                value={l.boe ?? ''}
                                disabled={!editable}
                                placeholder={l.boeCandidates.length ? 'Choose' : 'Missing'}
                                className={`font-mono text-[11px] ${l.boe ? (sameBoe ? 'text-text-muted' : '') : 'text-text-danger'}`}
                                onSave={setBoe(l)}
                              />
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{mixed ? '' : money(l.unitPrice)}</td>
                          <td className="px-3 py-1.5 text-right font-medium tabular-nums">{mixed ? '' : money(l.amount)}</td>
                          {editable && <td className="px-2 py-1.5 text-right">{lineButton(l)}</td>}
                        </tr>
                        {mixed &&
                          l.components.map((c, i) => (
                            <tr key={`${l.id}-${i}`} className="border-b border-border-muted/50 align-middle hover:bg-fill-muted/20">
                              <td className="px-3 py-1 text-[11px] text-text-muted">{lineNumber.get(l.id)}.{i + 1}</td>
                              <td className="py-1 pl-6 pr-1">
                                <div className="flex items-center gap-2 border-l-2 border-border-muted pl-2">
                                  <EditableText value={c.description} disabled={!editable} onSave={setComponent(l, i, 'description')} />
                                </div>
                              </td>
                              <td className="px-1 py-1">
                                <HsCodeSelect value={c.hsCode ?? l.hsCode} disabled={!editable} onSave={setComponent(l, i, 'hsCode')} />
                              </td>
                              <td className="px-1 py-1">
                                <EditableText value={c.origin} disabled={!editable} onSave={setComponent(l, i, 'origin')} placeholder="Add origin" className={c.origin ? '' : 'text-text-warning'} />
                              </td>
                              <td className="px-2 py-1 text-text-muted">1x{l.bottleSizeCl}cl</td>
                              <td className="px-2 py-1 text-right text-text-muted">–</td>
                              <td className="px-2 py-1 text-right tabular-nums">{l.qty}</td>
                              {doc.extraColumns.map((x) => (
                                <td key={x.key} />
                              ))}
                              <td />
                              <td className="px-2 py-1 text-right tabular-nums">{money(c.unitPrice)}</td>
                              <td className="px-3 py-1 text-right tabular-nums">{money(c.unitPrice * l.qty)}</td>
                              {editable && <td />}
                            </tr>
                          ))}
                        {openLine === l.id && (
                          <tr>
                            <td colSpan={colCount} className="bg-fill-muted/20 p-3">
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
          <div key={section.id} data-section={section.id} className="scroll-mt-24 overflow-hidden rounded-xl border border-border-muted bg-fill-primary">
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
                              <HsCodeSelect value={l.hsCode} disabled={!editable} onSave={setField(l, 'hsCode', 'HS code')} />
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
                                  <HsCodeSelect value={c.hsCode ?? l.hsCode} disabled={!editable} onSave={setComponent(l, i, 'hsCode')} />
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

      <div className="grid items-stretch gap-4 md:grid-cols-[3fr_2fr]">
        <div className="rounded-xl border border-border-muted bg-fill-primary p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Re-export bills of entry</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wide text-text-muted">
                <tr className="border-b border-border-muted"><th className="py-1.5 pr-3">BOE</th><th className="pr-3">Source invoice</th><th>Lines</th></tr>
              </thead>
              <tbody>
                {boes.map((b) => (
                  <tr key={b.boe ?? 'none'} className="border-b border-border-muted/60 align-top last:border-0">
                    <td className={`py-1.5 pr-3 font-mono ${b.boe ? '' : 'text-text-danger'}`}>{b.boe ?? 'Missing'}</td>
                    <td className="py-1.5 pr-3">{b.invoices.join(', ')}</td>
                    <td className="py-1.5">{b.lineRanges}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-xl border border-border-muted bg-fill-primary p-4">
          <div className="space-y-1.5 text-xs text-text-muted">
            <div className="flex justify-between"><span>Invoices billed (USD)</span><span className="tabular-nums">{money(totals.invoicesUsd)}</span></div>
            {cur !== 'USD' && (
              <div className="flex justify-between"><span>Fixed rate</span><span className="tabular-nums">× {doc.header.rate}</span></div>
            )}
            <div className="flex justify-between"><span>Freight</span><span>Ex Works</span></div>
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t-2 border-text-primary pt-3">
            <span className="text-sm font-semibold uppercase tracking-wide">Total</span>
            <span className="text-2xl font-semibold tabular-nums">{cur} {money(totals.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportDocumentPreview;
