'use client';

import {
  IconArrowRight,
  IconCheck,
  IconChevronRight,
  IconExternalLink,
  IconFileText,
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
import { EXPORT_MODES, EXPORT_STAGES, type ExportMode, type ExportStage, modeLabel, stageLabel } from '../../utils/exportStages';

const DOC_LABEL: Record<string, string> = {
  commercial_invoice: 'Invoice',
  customs_declaration: 'Customs / stamped paperwork',
  airway_bill: 'Airway bill',
  bill_of_lading: 'Bill of lading',
  other: 'Other',
};

const UPLOAD_KINDS: { key: ExportDocumentKind; label: string }[] = [
  { key: 'invoice', label: 'Invoice' },
  { key: 'awb', label: 'Airway bill' },
  { key: 'bl', label: 'Bill of lading' },
  { key: 'stamped', label: 'Stamped bond paperwork' },
  { key: 'other', label: 'Other' },
];

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

type Job = inferRouterOutputs<AppRouter>['logistics']['admin']['exports']['getOne'];

const JobView = ({ job }: { job: Job }) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { send, uploading } = useExportUpload(job.shipmentId);
  const [uploadKind, setUploadKind] = useState<ExportDocumentKind>('invoice');

  const [client, setClient] = useState<ClientValue>({ clientName: job.clientName, zohoCustomerId: job.zohoCustomerId });
  const [mode, setMode] = useState<ExportMode>(job.mode);
  const [originCity, setOriginCity] = useState(job.originCity ?? '');
  const [originCountry, setOriginCountry] = useState(job.originCountry ?? '');
  const [destinationCity, setDestinationCity] = useState(job.destinationCity ?? '');
  const [destinationCountry, setDestinationCountry] = useState(job.destinationCountry ?? '');
  const [carrierName, setCarrierName] = useState(job.carrierName ?? '');
  const [awbNumber, setAwbNumber] = useState(job.awbNumber ?? '');
  const [blNumber, setBlNumber] = useState(job.blNumber ?? '');
  const [exportInvoiceId, setExportInvoiceId] = useState<string | null>(job.linkedInvoice?.id ?? null);
  const [invoiceNumber, setInvoiceNumber] = useState(job.invoiceNumber ?? '');
  const [invoiceValue, setInvoiceValue] = useState(job.invoiceValue?.toString() ?? '');
  const [invoiceCurrency, setInvoiceCurrency] = useState(job.invoiceCurrency);
  const [notes, setNotes] = useState(job.notes ?? '');

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
    const value = invoiceValue.trim() === '' ? null : Number(invoiceValue);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      toast.error('Enter the invoice value as a number');
      return;
    }
    update.mutate(
      {
        shipmentId: job.shipmentId,
        clientName: client.clientName.trim(),
        zohoCustomerId: client.zohoCustomerId,
        mode,
        originCity: originCity.trim(),
        originCountry: originCountry.trim() || null,
        destinationCity: destinationCity.trim(),
        destinationCountry: destinationCountry.trim() || null,
        carrierName: carrierName.trim() || null,
        awbNumber: awbNumber.trim() || null,
        blNumber: blNumber.trim() || null,
        exportInvoiceId,
        invoiceNumber: invoiceNumber.trim() || null,
        invoiceValue: value,
        invoiceCurrency,
        notes: notes.trim() || null,
      },
      { onSuccess: () => toast.success('Job saved') },
    );
  };

  const field = (id: string, text: string, value: string, set: (v: string) => void, extra?: { inputMode?: 'decimal' }) => (
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
            </div>
            <div>
              <label htmlFor="notes" className={label}>
                Notes
              </label>
              <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${input} h-auto py-2`} />
            </div>
          </section>

          {/* Invoice */}
          <section className={`${card} space-y-4 p-5`}>
            <p className={sectionHeading}>Invoice</p>
            <div>
              <label htmlFor="export-invoice" className={label}>
                Export invoice
              </label>
              <ExportInvoiceSelect
                id="export-invoice"
                value={exportInvoiceId}
                onChange={(invoice) => {
                  setExportInvoiceId(invoice?.id ?? null);
                  if (!invoice) return;
                  if (invoice.number) setInvoiceNumber(invoice.number);
                  if (invoice.total != null) setInvoiceValue(String(Math.round(invoice.total * 100) / 100));
                  setInvoiceCurrency(invoice.currency);
                }}
              />
              {job.linkedInvoice?.pdfUrl ? (
                <a
                  href={job.linkedInvoice.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
                >
                  <IconExternalLink size={12} /> Open {job.linkedInvoice.number ?? 'invoice'} PDF
                </a>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem]">
              {field('invoice-number', 'Invoice number', invoiceNumber, setInvoiceNumber)}
              {field('invoice-value', 'Final invoice value', invoiceValue, setInvoiceValue, { inputMode: 'decimal' })}
              {field('invoice-currency', 'Currency', invoiceCurrency, (v) => setInvoiceCurrency(v.toUpperCase().slice(0, 3)))}
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
              <p className="py-4 text-center text-sm text-text-muted">No documents yet. Upload the invoice here.</p>
            ) : (
              <ul className="divide-y divide-border-muted">
                {job.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm text-text-primary hover:underline">
                      <IconFileText size={16} className="shrink-0 text-text-muted" />
                      <span className="truncate">{d.fileName}</span>
                    </a>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-text-muted">
                        {DOC_LABEL[d.documentType] ?? d.documentType} · {dayLabel(new Date(d.uploadedAt).toISOString())}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${d.fileName}`}
                        onClick={() => deleteDoc.mutate({ documentId: d.id })}
                        disabled={deleteDoc.isPending}
                        className="rounded p-1 text-text-muted hover:bg-surface-secondary hover:text-red-600"
                      >
                        <IconTrash size={14} />
                      </button>
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
            {job.invoiceValue != null ? (
              <p className="pt-1 text-xs text-text-muted">Invoice value {money(job.invoiceValue, job.invoiceCurrency)}</p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ExportJobClient;
