'use client';

import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClockHour4,
  IconDownload,
  IconFileText,
  IconInfoCircle,
  IconPaperclip,
  IconShieldCheck,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useRef, useState } from 'react';

import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

type Matched = inferRouterOutputs<AppRouter>['orderChecks']['match'];
type Finding = Matched['findings'][number];

const card = 'rounded-xl border border-border-muted bg-surface-primary shadow-sm';

const STATUS = {
  awaiting: { label: 'Awaiting documents', icon: IconClockHour4, tone: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900' },
  review: { label: 'Needs review', icon: IconAlertTriangle, tone: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-900' },
  matched: { label: 'Matched', icon: IconCircleCheck, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900' },
} as const;

const LEVEL = {
  error: { stripe: 'border-l-red-500', icon: IconX, text: 'text-red-700 dark:text-red-300', word: 'Fix' },
  warning: { stripe: 'border-l-amber-500', icon: IconAlertTriangle, text: 'text-amber-700 dark:text-amber-300', word: 'Check' },
  info: { stripe: 'border-l-blue-400', icon: IconInfoCircle, text: 'text-blue-700 dark:text-blue-300', word: 'Note' },
} as const;

type StatusKey = keyof typeof STATUS;

const StatusPill = ({ status, count }: { status: string | null; count?: number }) => {
  const s = STATUS[(status ?? 'awaiting') as StatusKey] ?? STATUS.awaiting;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.tone}`}>
      <Icon size={13} /> {s.label}
      {count ? ` (${count})` : ''}
    </span>
  );
};

const money = (n: number | null, currency?: string | null) =>
  n == null ? '—' : `${currency ? `${currency} ` : ''}${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const when = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

/** A photo shrunk to a sensible size before upload; a PDF is sent as it is */
const readForUpload = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That file could not be read'));
    reader.onload = () => {
      const url = String(reader.result);
      if (!file.type.startsWith('image/')) return resolve(url);
      const img = new Image();
      img.onerror = () => resolve(url);
      img.onload = () => {
        const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  });

const exportReport = async (r: Matched) => {
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet([
      { Order: r.soNumber ?? '', Customer: r.customerName ?? '', Status: STATUS[r.status as StatusKey]?.label ?? r.status, 'Awaiting': r.awaiting.join(', '), 'Checked at': new Date().toLocaleString('en-GB') },
    ]),
    'Summary',
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(
      r.findings.length
        ? r.findings.map((f) => ({ Level: LEVEL[f.level].word, Document: f.document, Where: f.where, Difference: f.message }))
        : [{ Level: '', Document: '', Where: '', Difference: 'No differences found' }],
    ),
    'Differences',
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(
      r.documents.map((d) => ({ Document: d.label, Status: d.status ?? '', Date: d.date ?? '', Reference: d.reference ?? '', Terms: d.terms ?? '', Currency: d.currency ?? '', Total: d.total ?? '', Lines: d.lineCount, Bottles: d.bottles })),
    ),
    'Documents',
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(
      r.matched.map((l) => ({ Wine: l.name, Vintage: l.vintage ?? '', 'Size (ml)': l.sizeMl ?? '', Bottles: l.bottles ?? '', 'Price per bottle': l.perBottle ?? '', 'Line total': l.lineTotal ?? '' })),
    ),
    'Matched lines',
  );
  XLSX.writeFile(book, `Order check ${r.soNumber ?? 'order'}.xlsx`);
};

const FindingCard = ({ f }: { f: Finding }) => {
  const l = LEVEL[f.level];
  const Icon = l.icon;
  return (
    <li className={`border-l-4 ${l.stripe} px-4 py-3`}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
        <span className={`inline-flex items-center gap-1 font-semibold ${l.text}`}>
          <Icon size={13} /> {l.word}
        </span>
        <span className="font-mono">{f.where}</span>
      </p>
      <p className="mt-0.5 text-sm text-text-primary">{f.message}</p>
    </li>
  );
};

/**
 * Check an order's paperwork as a set: client LPO, sales order and invoices
 *
 * Differences only, grouped by the document that needs correcting; lines that
 * agree everywhere collapse to a count. The LPO is attached once and kept, so
 * after a fix in Zoho, pressing Check again is all it takes.
 */
const OrderMatchPanel = () => {
  const api = useTRPC();
  const fileInput = useRef<HTMLInputElement>(null);
  const [number, setNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [showMatched, setShowMatched] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const list = useQuery({ ...api.orderChecks.list.queryOptions(), retry: false });
  const match = useMutation({ ...api.orderChecks.match.mutationOptions(), onSuccess: () => void list.refetch() });
  const signOff = useMutation({
    ...api.orderChecks.signOff.mutationOptions(),
    onSuccess: () => {
      void list.refetch();
      if (match.data?.soNumber) match.mutate({ number: match.data.soNumber });
    },
  });

  const run = async (n: string, attach: File | null) => {
    setReadError(null);
    try {
      const lpo = attach ? { file: await readForUpload(attach), fileName: attach.name } : undefined;
      match.mutate({ number: n.trim(), lpo });
      setFile(null);
    } catch (error) {
      setReadError(error instanceof Error ? error.message : 'That file could not be read');
    }
  };

  const r = match.data;
  const byDocument = r
    ? [...new Set(r.findings.map((f) => f.document))].map((doc) => ({ doc, items: r.findings.filter((f) => f.document === doc) }))
    : [];
  const changedSinceSignOff = r?.signOff && r.signOff.status !== r.status;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Check an order against its LPO</span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (number.trim().length >= 2) void run(number, file);
        }}
        className={`${card} flex flex-col gap-2 p-2 sm:flex-row sm:items-center`}
      >
        <input
          id="order-match-number"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Sales order or invoice number, e.g. SO-00198"
          className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <input
          ref={fileInput}
          id="order-match-lpo"
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="inline-flex h-10 min-w-0 items-center gap-1.5 rounded-lg border border-border-muted px-3 text-sm text-text-primary hover:bg-surface-secondary/60"
        >
          <IconPaperclip size={15} className="shrink-0" />
          <span className="truncate">{file ? file.name : 'Attach LPO'}</span>
        </button>
        <button
          type="submit"
          disabled={match.isPending || number.trim().length < 2}
          className="h-10 rounded-lg bg-text-primary px-4 text-sm font-medium text-surface-primary transition hover:opacity-90 disabled:opacity-50"
        >
          {match.isPending ? (file ? 'Reading LPO…' : 'Checking…') : 'Check order'}
        </button>
      </form>

      {readError || match.error ? (
        <p className={`${card} px-4 py-3 text-sm text-red-600`}>{readError ?? match.error?.message}</p>
      ) : null}

      {r ? (
        <div className={card}>
          <div className="flex flex-col gap-3 border-b border-border-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-text-primary">{r.soNumber ?? 'No sales order'}</span>
                <StatusPill status={r.status} count={r.status === 'review' ? r.counts.error + r.counts.warning : undefined} />
                {r.saleType ? (
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-text-muted">
                    {r.saleType === 'consignment' ? 'Consignment' : 'Regular sale'}
                  </span>
                ) : null}
              </p>
              <p className="truncate text-sm text-text-muted">{r.customerName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void exportReport(r)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-muted px-3 py-1.5 text-sm text-text-primary hover:bg-surface-secondary/60"
              >
                <IconDownload size={15} /> Export to Excel
              </button>
              {r.kept && r.soNumber ? (
                <button
                  type="button"
                  disabled={signOff.isPending}
                  onClick={() => signOff.mutate({ soNumber: r.soNumber! })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-text-primary px-3 py-1.5 text-sm font-medium text-surface-primary hover:opacity-90 disabled:opacity-50"
                >
                  <IconShieldCheck size={15} /> {r.signOff ? 'Sign off again' : 'Mark checked'}
                </button>
              ) : null}
            </div>
          </div>

          {r.signOff ? (
            <p className={`border-b border-border-muted px-4 py-2 text-xs ${changedSinceSignOff ? 'text-amber-700 dark:text-amber-300' : 'text-text-muted'}`}>
              Checked by {r.signOff.by ?? 'someone'} on {when(r.signOff.at)}
              {r.signOff.status && r.signOff.status !== 'matched' ? ` with the order at "${STATUS[r.signOff.status as StatusKey]?.label ?? r.signOff.status}"` : ''}
              {changedSinceSignOff ? '. The documents have changed since.' : '.'}
            </p>
          ) : null}

          {/* The documents in the set, and what is still missing */}
          <div className="flex flex-wrap gap-2 border-b border-border-muted px-4 py-3">
            {r.documents.map((d) => (
              <span key={d.label} className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-surface-muted px-2.5 py-1 text-xs text-text-primary">
                <IconFileText size={13} className="shrink-0 text-text-muted" />
                <span className="truncate">
                  <b className="font-medium">{d.label}</b>
                  {d.status ? ` · ${d.status}` : ''} · {money(d.total, d.currency)}
                  {d.kind === 'lpo' && r.lpo?.readBy === 'scan' ? ' · read from a scan' : ''}
                </span>
              </span>
            ))}
            {r.awaiting.map((a) => (
              <span key={a} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-amber-400 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-300">
                <IconClockHour4 size={13} /> Awaiting {a.toLowerCase()}
              </span>
            ))}
          </div>

          {r.lpo?.readBy === 'scan' ? (
            <p className="border-b border-border-muted px-4 py-2 text-xs text-text-muted">
              The LPO is a scan, so its figures were read from the image. A misread figure shows below as a difference.
            </p>
          ) : null}

          {byDocument.length > 0 ? (
            <div className="divide-y divide-border-muted">
              {byDocument.map(({ doc, items }) => (
                <div key={doc}>
                  <p className="bg-surface-secondary/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{doc}</p>
                  <ul className="divide-y divide-border-muted">
                    {items.map((f, i) => (
                      <FindingCard key={`${f.code}-${i}`} f={f} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-4 text-sm text-text-muted">
              {r.status === 'awaiting' ? 'No differences in the documents so far.' : 'No differences: every document agrees.'}
            </p>
          )}

          {r.totalLines > 0 ? (
            <div className="border-t border-border-muted">
              <button
                type="button"
                onClick={() => setShowMatched((s) => !s)}
                className="w-full px-4 py-2 text-left text-xs font-medium text-text-muted hover:bg-surface-secondary/50 hover:text-text-primary"
              >
                {r.matched.length} of {r.totalLines} line{r.totalLines === 1 ? '' : 's'} agree on every document
                {r.matched.length ? (showMatched ? ' · hide' : ' · show') : ''}
              </button>
              {showMatched ? (
                <ul className="divide-y divide-border-muted border-t border-border-muted">
                  {r.matched.map((l, i) => (
                    <li key={i} className="flex justify-between gap-4 px-4 py-2 text-sm">
                      <span className="min-w-0 truncate text-text-primary">
                        {l.name}
                        {l.vintage && !l.name.includes(l.vintage) ? ` ${l.vintage}` : ''}
                      </span>
                      <span className="shrink-0 tabular-nums text-text-muted">
                        {l.bottles ?? '—'} btl · {money(l.lineTotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {!r.kept ? (
            <p className="border-t border-border-muted px-4 py-2 text-xs text-text-muted">
              This check was not saved, so the LPO needs attaching again next time and sign-off is unavailable.
            </p>
          ) : null}
        </div>
      ) : null}

      {list.data?.rows.length ? (
        <div className={card}>
          <p className="border-b border-border-muted px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Recent order checks
          </p>
          <ul className="divide-y divide-border-muted">
            {list.data.rows.map((row) => (
              <li key={row.soNumber}>
                <button
                  type="button"
                  onClick={() => {
                    setNumber(row.soNumber);
                    void run(row.soNumber, null);
                  }}
                  className="flex w-full flex-col gap-1 px-4 py-2.5 text-left hover:bg-surface-secondary/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="font-mono text-sm text-text-primary">{row.soNumber}</span>
                    <span className="ml-2 text-sm text-text-muted">
                      {row.customerName}
                      {row.lpoNumber ? ` · LPO ${row.lpoNumber}` : ' · no LPO'}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {row.signedOffAt ? (
                      <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                        <IconShieldCheck size={13} /> {row.signedOffBy ?? 'Checked'}
                      </span>
                    ) : null}
                    <StatusPill
                      status={row.lastStatus}
                      count={row.lastStatus === 'review' ? (row.lastCounts?.error ?? 0) + (row.lastCounts?.warning ?? 0) : undefined}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};

export default OrderMatchPanel;
