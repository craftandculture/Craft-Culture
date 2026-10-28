'use client';

import {
  IconArrowRight,
  IconCheck,
  IconChevronRight,
  IconExternalLink,
  IconFileText,
  IconPlus,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';
import fileHref from '@/utils/fileHref';

import ShipmentTypeBadge from '../ShipmentTypeBadge';
import BondPanel from './BondPanel';
import ClientPicker, { type ClientValue } from './ClientPicker';
import ExportInvoiceSelect from './ExportInvoiceSelect';
import {
  card,
  dayLabel,
  input,
  label,
  money,
  pill,
  pillClass,
  primaryButton,
  secondaryButton,
  sectionHeading,
  stageTone,
} from './exportUi';
import useExportUpload, { type ExportDocumentKind } from './useExportUpload';
import ZohoInvoiceInput from './ZohoInvoiceInput';
import { EXPORT_MODES, EXPORT_STAGES, type ExportMode, type ExportStage, modeLabel, stageLabel } from '../../utils/exportStages';

const DOC_LABEL: Record<string, string> = {
  commercial_invoice: 'Invoice',
  customs_declaration: 'Customs / stamped paperwork',
  airway_bill: 'Airway bill',
  bill_of_lading: 'Bill of lading',
  other: 'Other',
};

/** An export job either leaves the UAE or moves stock within it */
const JOB_KINDS = [
  { key: 'outbound', label: 'Export (leaving UAE)' },
  { key: 'mainland_transfer', label: 'Mainland transfer (UAE → UAE)' },
] as const;

const UPLOAD_KINDS: { key: ExportDocumentKind; label: string }[] = [
  { key: 'invoice', label: 'Invoice' },
  { key: 'awb', label: 'Airway bill' },
  { key: 'bl', label: 'Bill of lading' },
  { key: 'stamped', label: 'Stamped bond paperwork' },
  { key: 'other', label: 'Other' },
];

type Job = inferRouterOutputs<AppRouter>['logistics']['admin']['exports']['getOne'];

/** One Zoho invoice row on the job, as typed */
interface ZohoRow {
  number: string;
  value: string;
  currency: string;
}

const blankZohoRow = (currency: string): ZohoRow => ({ number: '', value: '', currency });

/** The value as a number, null when blank, NaN when it is not a number */
const parseValue = (v: string) => (v.trim() === '' ? null : Number(v));

/** Totals of the Zoho invoices, one per currency, e.g. "AED 11,364.42 + EUR 900.00" */
const invoiceTotals = (rows: { value: number | null; currency: string }[]) => {
  const byCurrency = new Map<string, number>();
  for (const r of rows) {
    if (r.value == null || !Number.isFinite(r.value)) continue;
    byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0) + r.value);
  }
  return [...byCurrency].map(([currency, total]) => money(total, currency)).join(' + ');
};

const JobView = ({ job }: { job: Job }) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { send, uploading } = useExportUpload(job.shipmentId);
  const [uploadKind, setUploadKind] = useState<ExportDocumentKind>('invoice');

  const [client, setClient] = useState<ClientValue>({ clientName: job.clientName, zohoCustomerId: job.zohoCustomerId });
  const [mode, setMode] = useState<ExportMode>(job.mode);
  const [shipmentType, setShipmentType] = useState<'outbound' | 'mainland_transfer'>(
    job.shipmentType === 'mainland_transfer' ? 'mainland_transfer' : 'outbound',
  );
  const [originCity, setOriginCity] = useState(job.originCity ?? '');
  const [originCountry, setOriginCountry] = useState(job.originCountry ?? '');
  const [destinationCity, setDestinationCity] = useState(job.destinationCity ?? '');
  const [destinationCountry, setDestinationCountry] = useState(job.destinationCountry ?? '');
  const [carrierName, setCarrierName] = useState(job.carrierName ?? '');
  const [awbNumber, setAwbNumber] = useState(job.awbNumber ?? '');
  const [blNumber, setBlNumber] = useState(job.blNumber ?? '');
  // The first of each list is the job's main invoice; the rest are added after it
  const [exportInvoiceIds, setExportInvoiceIds] = useState<(string | null)[]>(
    job.linkedInvoices.length > 0 ? job.linkedInvoices.map((i) => i.id) : [null],
  );
  const [zohoRows, setZohoRows] = useState<ZohoRow[]>([
    { number: job.invoiceNumber ?? '', value: job.invoiceValue?.toString() ?? '', currency: job.invoiceCurrency },
    ...job.additionalInvoices.map((i) => ({ number: i.number, value: i.value?.toString() ?? '', currency: i.currency })),
  ]);
  const setZohoRow = (index: number, patch: Partial<ZohoRow>) =>
    setZohoRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const setExportInvoiceAt = (index: number, id: string | null) =>
    setExportInvoiceIds((ids) => ids.map((x, i) => (i === index ? id : x)));
  const [notes, setNotes] = useState(job.notes ?? '');
  const [cases, setCases] = useState(job.totalCases ? String(job.totalCases) : '');
  const [bottles, setBottles] = useState(job.totalBottles ? String(job.totalBottles) : '');

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: api.logistics.admin.exports.getOne.queryKey({ shipmentId: job.shipmentId }) });
    void queryClient.invalidateQueries({ queryKey: api.logistics.admin.exports.getMany.queryKey() });
  };

  const update = useMutation({
    ...api.logistics.admin.exports.update.mutationOptions(),
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  const deleteDoc = useMutation({
    ...api.logistics.admin.deleteDocument.mutationOptions(),
    onSuccess: () => {
      toast.success('Document removed');
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const stageIndex = EXPORT_STAGES.findIndex((s) => s.key === job.stage);
  const next = EXPORT_STAGES[stageIndex + 1];

  const setStage = (stage: ExportStage) =>
    update.mutate({ shipmentId: job.shipmentId, stage }, { onSuccess: () => toast.success(`Moved to ${stageLabel(stage)}`) });

  const saveDetails = () => {
    if (!client.clientName.trim() || !originCity.trim() || !destinationCity.trim()) {
      toast.error('Client, origin and destination are required');
      return;
    }
    // Blank rows after the first are dropped; the first is the job's main invoice even when empty
    const [first = blankZohoRow(job.invoiceCurrency), ...rest] = zohoRows;
    const extra = rest.filter((r) => r.number.trim() || r.value.trim());
    const firstValue = parseValue(first.value);
    const extraValues = extra.map((r) => parseValue(r.value));
    if ([firstValue, ...extraValues].some((v) => v !== null && (!Number.isFinite(v) || v < 0))) {
      toast.error('Enter each invoice value as a number');
      return;
    }
    if (extra.some((r) => !r.number.trim())) {
      toast.error('Enter the Zoho invoice number for each added invoice');
      return;
    }
    const linkedIds = [...new Set(exportInvoiceIds.filter((id): id is string => !!id))];
    const count = (v: string) => (v.trim() === '' ? 0 : Number(v));
    const totalCases = count(cases);
    const totalBottles = count(bottles);
    if (![totalCases, totalBottles].every((n) => Number.isInteger(n) && n >= 0)) {
      toast.error('Enter cases and bottles as whole numbers');
      return;
    }
    update.mutate(
      {
        shipmentId: job.shipmentId,
        clientName: client.clientName.trim(),
        zohoCustomerId: client.zohoCustomerId,
        mode,
        shipmentType,
        originCity: originCity.trim(),
        originCountry: originCountry.trim() || null,
        destinationCity: destinationCity.trim(),
        destinationCountry: destinationCountry.trim() || null,
        carrierName: carrierName.trim() || null,
        awbNumber: awbNumber.trim() || null,
        blNumber: blNumber.trim() || null,
        exportInvoiceId: linkedIds[0] ?? null,
        additionalExportInvoiceIds: linkedIds.slice(1),
        invoiceNumber: first.number.trim() || null,
        invoiceValue: firstValue,
        invoiceCurrency: first.currency,
        additionalInvoices: extra.map((r, i) => ({ number: r.number.trim(), value: extraValues[i] ?? null, currency: r.currency })),
        totalCases,
        totalBottles,
        notes: notes.trim() || null,
      },
      { onSuccess: () => toast.success('Job saved') },
    );
  };

  const field = (id: string, text: string, value: string, set: (v: string) => void, extra?: { inputMode?: 'decimal' | 'numeric' }) => (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <input id={id} value={value} onChange={(e) => set(e.target.value)} className={input} inputMode={extra?.inputMode} />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-sm text-text-muted">
            <Link href="/platform/admin/logistics/exports" className="transition-colors hover:text-text-primary">
              Exports
            </Link>
            <IconChevronRight className="size-4" />
            <span className="text-text-primary">{job.jobNumber}</span>
          </div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-text-primary">
            <span className="font-mono">{job.jobNumber}</span>
            <span className={pillClass(stageTone(job.stage))}>{stageLabel(job.stage)}</span>
            <ShipmentTypeBadge type={job.shipmentType} />
          </h1>
          <p className="mt-0.5 truncate text-sm text-text-muted">
            {job.clientName} · {modeLabel(job.mode)} · {job.originCity || '—'} → {job.destinationCity || '—'} ·{' '}
            <Link href={`/platform/admin/logistics/shipments/${job.shipmentId}`} className="underline-offset-2 hover:underline">
              {job.shipmentNumber}
            </Link>
          </p>
        </div>
        {next ? (
          <button type="button" onClick={() => setStage(next.key)} disabled={update.isPending} className={primaryButton}>
            {next.label} <IconArrowRight size={16} />
          </button>
        ) : (
          <span className={pillClass('emerald')}>
            <IconCheck size={12} /> Complete
          </span>
        )}
      </div>

      {/* Stage strip */}
      <ol className={`${card} grid grid-cols-2 gap-1 p-2 sm:grid-cols-3 lg:grid-cols-6`}>
        {EXPORT_STAGES.map((s, i) => {
          const done = i < stageIndex;
          const current = i === stageIndex;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => !current && setStage(s.key)}
                disabled={update.isPending}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  current
                    ? 'bg-text-primary font-medium text-surface-primary'
                    : done
                      ? 'text-text-primary hover:bg-surface-secondary'
                      : 'text-text-muted hover:bg-surface-secondary'
                }`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    current
                      ? 'bg-surface-primary text-text-primary'
                      : done
                        ? 'bg-emerald-500 text-white'
                        : 'bg-surface-muted text-text-muted'
                  }`}
                >
                  {done ? <IconCheck size={12} /> : i + 1}
                </span>
                <span className="truncate">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {/* Details */}
          <section className={`${card} space-y-4 p-5`}>
            <p className={sectionHeading}>Job details</p>
            <div>
              <label htmlFor="client" className={label}>
                Client *
              </label>
              <ClientPicker id="client" value={client} onChange={setClient} />
            </div>
            <div>
              <span className={label}>Kind</span>
              <div className="flex flex-wrap gap-2">
                {JOB_KINDS.map((k) => (
                  <button key={k.key} type="button" className={pill(shipmentType === k.key)} onClick={() => setShipmentType(k.key)}>
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className={label}>Mode</span>
              <div className="flex flex-wrap gap-2">
                {EXPORT_MODES.map((m) => (
                  <button key={m.key} type="button" className={pill(mode === m.key)} onClick={() => setMode(m.key)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {field('origin', 'Origin *', originCity, setOriginCity)}
              {field('origin-country', 'Origin country', originCountry, setOriginCountry)}
              {field('destination', 'Destination *', destinationCity, setDestinationCity)}
              {field('destination-country', 'Destination country', destinationCountry, setDestinationCountry)}
              {field('carrier', 'Carrier or transporter', carrierName, setCarrierName)}
              {mode === 'air' ? field('awb', 'AWB number', awbNumber, setAwbNumber) : null}
              {mode === 'sea_fcl' || mode === 'sea_lcl' ? field('bl', 'BL number', blNumber, setBlNumber) : null}
              {field('cases', 'Cases', cases, setCases, { inputMode: 'numeric' })}
              {field('bottles', 'Bottles', bottles, setBottles, { inputMode: 'numeric' })}
            </div>
            <div>
              <label htmlFor="notes" className={label}>
                Notes
              </label>
              <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${input} h-auto py-2`} />
            </div>
          </section>

          {/* Invoices — a shipment can carry several of each */}
          <section className={`${card} space-y-5 p-5`}>
            <p className={sectionHeading}>Invoices</p>
            <div className="space-y-2">
              <p className={label}>C&C export invoices (customs paperwork)</p>
              {exportInvoiceIds.map((linkedId, index) => {
                const linked = job.linkedInvoices.find((i) => i.id === linkedId);
                return (
                  <div key={index}>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <ExportInvoiceSelect
                          id={`export-invoice-${index}`}
                          zohoCustomerId={client.zohoCustomerId}
                          value={linkedId}
                          onChange={(invoice) => {
                            setExportInvoiceAt(index, invoice?.id ?? null);
                            // Only the first export invoice fills the Zoho fields, as before
                            if (!invoice || index !== 0) return;
                            setZohoRow(0, {
                              ...(invoice.number && { number: invoice.number }),
                              ...(invoice.total != null && { value: String(Math.round(invoice.total * 100) / 100) }),
                              currency: invoice.currency,
                            });
                          }}
                        />
                      </div>
                      {exportInvoiceIds.length > 1 ? (
                        <button
                          type="button"
                          aria-label="Remove this export invoice"
                          onClick={() => setExportInvoiceIds((ids) => ids.filter((_, i) => i !== index))}
                          className="shrink-0 rounded-lg p-2 text-text-muted hover:bg-surface-secondary hover:text-text-primary"
                        >
                          <IconTrash size={16} />
                        </button>
                      ) : null}
                    </div>
                    {linkedId ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <Link
                          href={`/platform/admin/logistics/export-invoices/${linkedId}`}
                          className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
                        >
                          <IconArrowRight size={12} /> Open in Export Invoices
                        </Link>
                        {linked?.pdfUrl ? (
                          <a
                            href={fileHref(linked.pdfUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
                          >
                            <IconExternalLink size={12} /> Open {linked.number ?? 'invoice'} PDF
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {exportInvoiceIds.every(Boolean) ? (
                  <button type="button" onClick={() => setExportInvoiceIds((ids) => [...ids, null])} className={secondaryButton}>
                    <IconPlus size={14} /> Add another export invoice
                  </button>
                ) : null}
                <Link href={`/platform/admin/logistics/export-invoices/new?shipmentId=${job.shipmentId}`} className={secondaryButton}>
                  <IconPlus size={14} /> Create export invoice
                </Link>
                <span className="text-xs text-text-muted">
                  {client.zohoCustomerId !== job.zohoCustomerId || (zohoRows[0]?.number.trim() || null) !== job.invoiceNumber
                    ? 'Save the job first so the client and Zoho invoices carry across.'
                    : 'Opens with this client and the Zoho invoices chosen, and links back here.'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {zohoRows.map((row, index) => (
                <div key={index} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_6rem_2.25rem]">
                  <div>
                    <label htmlFor={`invoice-number-${index}`} className={index === 0 ? label : 'sr-only'}>
                      Zoho invoice number
                    </label>
                    <ZohoInvoiceInput
                      id={`invoice-number-${index}`}
                      value={row.number}
                      onChange={(v) => setZohoRow(index, { number: v })}
                      zohoCustomerId={client.zohoCustomerId}
                      onPick={(inv) => {
                        setZohoRow(index, {
                          number: inv.invoiceNumber,
                          value: String(Math.round(inv.total * 100) / 100),
                          currency: inv.currency,
                        });
                        if (!client.zohoCustomerId) setClient({ clientName: inv.customerName, zohoCustomerId: inv.zohoCustomerId });
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor={`invoice-value-${index}`} className={index === 0 ? label : 'sr-only'}>
                      Final invoice value
                    </label>
                    <input
                      id={`invoice-value-${index}`}
                      value={row.value}
                      onChange={(e) => setZohoRow(index, { value: e.target.value })}
                      className={input}
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <label htmlFor={`invoice-currency-${index}`} className={index === 0 ? label : 'sr-only'}>
                      Currency
                    </label>
                    <input
                      id={`invoice-currency-${index}`}
                      value={row.currency}
                      onChange={(e) => setZohoRow(index, { currency: e.target.value.toUpperCase().slice(0, 3) })}
                      className={input}
                    />
                  </div>
                  {index > 0 ? (
                    <button
                      type="button"
                      aria-label="Remove this Zoho invoice"
                      onClick={() => setZohoRows((rows) => rows.filter((_, i) => i !== index))}
                      className="rounded-lg p-2 text-text-muted hover:bg-surface-secondary hover:text-text-primary"
                    >
                      <IconTrash size={16} />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setZohoRows((rows) => [...rows, blankZohoRow(rows[0]?.currency ?? job.invoiceCurrency)])}
                  className={secondaryButton}
                >
                  <IconPlus size={14} /> Add another Zoho invoice
                </button>
                {zohoRows.length > 1 ? (
                  <span className="text-sm text-text-muted">
                    Total{' '}
                    <span className="font-medium text-text-primary">
                      {invoiceTotals(zohoRows.map((r) => ({ value: parseValue(r.value), currency: r.currency }))) || '—'}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <button type="button" onClick={saveDetails} disabled={update.isPending} className={primaryButton}>
              {update.isPending ? 'Saving…' : 'Save job'}
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {job.bond && job.mode === 'bonded' ? (
            <BondPanel shipmentId={job.shipmentId} bond={job.bond} today={job.today} />
          ) : null}

          {/* Documents */}
          <section className={`${card} space-y-3 p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className={sectionHeading}>Documents</p>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">
                  {job.documents.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Document type"
                  value={uploadKind}
                  onChange={(e) => setUploadKind(e.target.value as ExportDocumentKind)}
                  className={`${input} h-9 w-auto`}
                >
                  {UPLOAD_KINDS.filter((k) => k.key !== 'stamped' || job.mode === 'bonded').map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void send(f, uploadKind);
                    e.target.value = '';
                  }}
                />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={secondaryButton}>
                  <IconUpload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
            {job.documents.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-muted">
                No documents yet. Issue the linked export invoice, or upload documents here.
              </p>
            ) : (
              <ul className="divide-y divide-border-muted">
                {job.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                    <a href={fileHref(d.fileUrl)} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm text-text-primary hover:underline">
                      <IconFileText size={16} className="shrink-0 text-text-muted" />
                      <span className="truncate">{d.fileName}</span>
                    </a>
                    <div className="flex shrink-0 items-center gap-2">
                      {d.fromExportInvoice ? <span className={pillClass('slate')}>From export invoice</span> : null}
                      <span className="text-xs text-text-muted">
                        {DOC_LABEL[d.documentType] ?? d.documentType} · {dayLabel(new Date(d.uploadedAt).toISOString())}
                      </span>
                      {d.fromExportInvoice ? null : (
                        <button
                          type="button"
                          aria-label={`Remove ${d.fileName}`}
                          onClick={() => deleteDoc.mutate({ documentId: d.id })}
                          disabled={deleteDoc.isPending}
                          className="rounded p-1 text-text-muted hover:bg-surface-secondary hover:text-red-600"
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* History */}
          <section className={`${card} space-y-2 p-5`}>
            <p className={sectionHeading}>History</p>
            <ul className="space-y-1.5">
              {job.history.map((h) => (
                <li key={h.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-text-primary">{h.notes ?? h.action}</span>
                  <span className="shrink-0 text-xs text-text-muted">{dayLabel(new Date(h.createdAt).toISOString())}</span>
                </li>
              ))}
            </ul>
            {invoiceTotals([{ value: job.invoiceValue, currency: job.invoiceCurrency }, ...job.additionalInvoices]) ? (
              <p className="pt-1 text-xs text-text-muted">
                Invoice value {invoiceTotals([{ value: job.invoiceValue, currency: job.invoiceCurrency }, ...job.additionalInvoices])}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
};

/**
 * One export job: its stage, details, invoice, bond and documents
 *
 * The stage strip is the job's progress; pressing the next stage moves it on.
 * Details are edited in place and saved together.
 */
const ExportJobClient = ({ shipmentId }: { shipmentId: string }) => {
  const api = useTRPC();
  const { data: job, isLoading, error } = useQuery(api.logistics.admin.exports.getOne.queryOptions({ shipmentId }));

  if (isLoading) return <p className="py-16 text-center text-sm text-text-muted">Loading job…</p>;
  if (error || !job) {
    return <p className={`${card} p-6 text-sm text-text-muted`}>This export job could not be loaded{error ? `: ${error.message}` : ''}.</p>;
  }

  // The form holds its own edits; documents, bond and history read the fresh query
  return <JobView key={job.shipmentId} job={job} />;
};

export default ExportJobClient;
