'use client';

import { IconCheck, IconLoader2, IconPlus, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import type { QuoteDraft } from '../../utils/pendingQuoteDraft';
import { card, input, label, primaryButton, secondaryButton, sectionHeading } from '../exports/exportUi';

type Request = inferRouterOutputs<AppRouter>['logistics']['admin']['requests']['getOne'];
type Mode = 'sea_fcl' | 'sea_lcl' | 'air' | 'road';

/** What the editor opens on: a quote read from the forwarder's document, or one already saved */
export type QuoteEditorTarget =
  | {
      kind: 'new';
      draft: QuoteDraft | null;
      file: { base64: string; fileName: string; mimeType: string } | null;
    }
  | { kind: 'edit'; quoteId: string };

export interface QuoteEditorProps {
  request: Request;
  target: QuoteEditorTarget;
  onDone: () => void;
}

const CATEGORIES = [
  'Freight',
  'Origin Handling',
  'Destination Handling',
  'Documentation',
  'Customs',
  'Insurance',
  'Local Delivery',
  'Other',
];

const MODES: { key: Mode; label: string }[] = [
  { key: 'air', label: 'Air' },
  { key: 'sea_lcl', label: 'Sea, shared container' },
  { key: 'sea_fcl', label: 'Sea, full container' },
  { key: 'road', label: 'Road' },
];

interface Line {
  category: string;
  description: string;
  amount: string;
}

const blankLine: Line = { category: 'Freight', description: '', amount: '' };
const isoDay = (d: Date | string | null | undefined) =>
  !d ? '' : typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
const amountOf = (v: string) => {
  const n = Number(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Check and save a forwarder's quote without leaving the request
 *
 * Used both for a quote just read from the forwarder's PDF or email, where it
 * opens filled in, and for one already saved. The total is always the sum of
 * the lines, so a misread line shows up against the document's own total. A
 * validity already gone is flagged, because it is usually the quote date read
 * by mistake; saving a date still to come makes an expired quote live again.
 */
const QuoteEditor = ({ request, target, onDone }: QuoteEditorProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const draft = target.kind === 'new' ? target.draft : null;
  const file = target.kind === 'new' ? target.file : null;

  const { data: saved, isLoading } = useQuery({
    ...api.logistics.admin.quotes.getOne.queryOptions({ id: target.kind === 'edit' ? target.quoteId : '' }),
    enabled: target.kind === 'edit',
  });
  const { data: forwarders = [] } = useQuery(api.logistics.admin.forwarders.getMany.queryOptions({}));

  const [forwarderName, setForwarderName] = useState(draft?.matchedForwarderName ?? draft?.forwarderName ?? '');
  const [forwarderEmail, setForwarderEmail] = useState(draft?.forwarderEmail ?? '');
  const [contact, setContact] = useState(draft?.contactName ?? '');
  const [reference, setReference] = useState(draft?.forwarderReference ?? '');
  const [currency, setCurrency] = useState(draft?.currency || 'USD');
  const [mode, setMode] = useState<Mode | ''>(draft?.transportMode ?? request.transportMode ?? '');
  const [transitDays, setTransitDays] = useState(draft?.transitDays ? String(draft.transitDays) : '');
  const [validUntil, setValidUntil] = useState(isoDay(draft?.validUntil));
  const [notes, setNotes] = useState(draft?.notes ?? '');
  const [lines, setLines] = useState<Line[]>(
    draft?.lineItems.length
      ? draft.lineItems.map((l) => ({ category: l.category, description: l.description, amount: String(l.total) }))
      : draft
        ? [{ category: 'Freight', description: 'Freight', amount: String(draft.totalPrice) }]
        : [blankLine],
  );

  // A saved quote fills the form once it loads
  const filled = useRef(false);
  useEffect(() => {
    if (!saved || filled.current) return;
    filled.current = true;
    setForwarderName(saved.forwarderName);
    setForwarderEmail(saved.forwarderEmail ?? '');
    setContact(saved.forwarderContact ?? '');
    setReference(saved.forwarderReference ?? '');
    setCurrency(saved.currency);
    setMode(saved.transportMode ?? '');
    setTransitDays(saved.transitDays ? String(saved.transitDays) : '');
    setValidUntil(isoDay(saved.validUntil));
    setNotes(saved.notes ?? '');
    setLines(
      saved.lineItems.length
        ? saved.lineItems.map((l) => ({ category: l.category, description: l.description, amount: String(l.total) }))
        : [{ category: 'Freight', description: 'Freight', amount: String(saved.totalPrice) }],
    );
  }, [saved]);

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests']] });
    void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'quotes']] });
    void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getDashboardMetrics']] });
    onDone();
  };
  const onError = (error: { message: string }) => toast.error(error.message || 'The quote was not saved');

  const { mutateAsync: uploadAttachment } = useMutation(api.logistics.admin.quotes.uploadAttachment.mutationOptions());
  const create = useMutation({
    ...api.logistics.admin.quotes.create.mutationOptions(),
    onSuccess: async (quote) => {
      if (file) {
        await uploadAttachment({
          quoteId: quote.id,
          fileName: file.fileName,
          fileData: file.base64,
          mimeType: file.mimeType,
        }).catch(() => toast.error('The quote was saved, but its document could not be attached'));
      }
      toast.success(`Quote from ${quote.forwarderName} saved`);
      done();
    },
    onError,
  });
  const update = useMutation({
    ...api.logistics.admin.quotes.update.mutationOptions(),
    onSuccess: (quote) => {
      toast.success(quote.status === 'pending' ? 'Quote saved; it is live' : 'Quote saved');
      done();
    },
    onError,
  });

  const total = Math.round(lines.reduce((s, l) => s + amountOf(l.amount), 0) * 100) / 100;
  const today = new Date().toISOString().slice(0, 10);
  const pastValidity = !!validUntil && validUntil < today;
  const matched = forwarders.find((f) => f.name.toLowerCase() === forwarderName.trim().toLowerCase());
  const filledLines = lines.filter((l) => amountOf(l.amount) !== 0);
  const ready = !!forwarderName.trim() && total > 0 && /^[A-Za-z]{3}$/.test(currency.trim());

  const save = () => {
    const lineItems = filledLines.map((l) => ({
      category: l.category,
      description: l.description.trim() || l.category,
      quantity: 1,
      total: amountOf(l.amount),
    }));
    const common = {
      forwarderName: matched?.name ?? forwarderName.trim(),
      forwarderContact: contact.trim() || undefined,
      forwarderEmail: forwarderEmail.trim() || undefined,
      forwarderReference: reference.trim(),
      currency: currency.trim().toUpperCase(),
      transportMode: mode || undefined,
      transitDays: transitDays ? Math.round(Number(transitDays)) || undefined : undefined,
      notes: notes.trim() || undefined,
      totalPrice: total,
      lineItems,
    };

    if (target.kind === 'edit') {
      update.mutate({ id: target.quoteId, ...common, validUntil: validUntil ? new Date(`${validUntil}T23:59:00`) : null });
      return;
    }

    create.mutate({
      ...common,
      forwarderId: matched?.id,
      requestId: request.id,
      originCountry: request.originCountry,
      originCity: request.originCity ?? undefined,
      destinationCountry: request.destinationCountry,
      destinationCity: request.destinationCity ?? undefined,
      validUntil: validUntil ? new Date(`${validUntil}T23:59:00`) : undefined,
    });
  };

  const setLine = (i: number, field: keyof Line, value: string) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [field]: value } : l)));

  if (target.kind === 'edit' && isLoading) {
    return (
      <div className={`${card} flex justify-center p-8`}>
        <IconLoader2 className="animate-spin text-text-muted" />
      </div>
    );
  }

  const pending = create.isPending || update.isPending;

  return (
    <div id="quote-editor" className={`${card} space-y-4 border-text-primary p-4`}>
      <div className="flex items-center gap-2">
        <span className={sectionHeading}>
          {target.kind === 'edit' ? `Edit quote ${saved?.quoteNumber ?? ''}` : 'Check the quote and save'}
        </span>
        <button type="button" aria-label="Close" className="ml-auto text-text-muted hover:text-text-primary" onClick={onDone}>
          <IconX size={16} />
        </button>
      </div>

      {draft && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            draft.linesMatchTotal
              ? 'bg-surface-secondary text-text-primary'
              : 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200'
          }`}
        >
          Read from {file ? file.fileName : 'the pasted email'}: document total {draft.currency} {fmt(draft.totalPrice)}
          {draft.lineItems.length > 0 && !draft.linesMatchTotal
            ? `, but the lines add up to ${fmt(draft.lineSum)}. Find the missing or misread line.`
            : '. Check each figure against the document.'}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className={label}>Forwarder</span>
          <input
            className={input}
            list="quote-editor-forwarders"
            value={forwarderName}
            onChange={(e) => setForwarderName(e.target.value)}
            placeholder="e.g. Hillebrand"
          />
          <datalist id="quote-editor-forwarders">
            {forwarders.map((f) => (
              <option key={f.id} value={f.name} />
            ))}
          </datalist>
          {forwarderName.trim() && !matched && (
            <span className="mt-1 block text-xs text-text-muted">A new forwarder; added when you save.</span>
          )}
        </label>
        <label className="block">
          <span className={label}>Their reference</span>
          <input className={input} value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <label className="block">
          <span className={label}>Currency</span>
          <input
            className={`${input} uppercase`}
            maxLength={3}
            list="quote-editor-currencies"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          />
          <datalist id="quote-editor-currencies">
            {['USD', 'EUR', 'GBP', 'AED', 'CHF'].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        {!matched && (
          <>
            <label className="block sm:col-span-2">
              <span className={label}>Their email</span>
              <input
                className={input}
                type="email"
                value={forwarderEmail}
                onChange={(e) => setForwarderEmail(e.target.value)}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={label}>Contact</span>
              <input className={input} value={contact} onChange={(e) => setContact(e.target.value)} />
            </label>
          </>
        )}
      </div>

      <div className="space-y-2">
        <span className={label}>Charges</span>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[11rem_1fr_9rem_auto]">
            <select
              className={`${input} col-span-2 sm:col-span-1`}
              value={l.category}
              onChange={(e) => setLine(i, 'category', e.target.value)}
            >
              {[...new Set([...CATEGORIES, l.category])].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className={`${input} col-span-2 sm:col-span-1`}
              placeholder="Description"
              value={l.description}
              onChange={(e) => setLine(i, 'description', e.target.value)}
            />
            <input
              className={`${input} text-right tabular-nums`}
              inputMode="decimal"
              placeholder="0.00"
              value={l.amount}
              onChange={(e) => setLine(i, 'amount', e.target.value)}
            />
            <button
              type="button"
              aria-label="Remove this charge"
              className={secondaryButton}
              onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [blankLine]))}
            >
              <IconX size={15} />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <button type="button" className={secondaryButton} onClick={() => setLines((ls) => [...ls, blankLine])}>
            <IconPlus size={15} /> Another charge
          </button>
          <span className="ml-auto text-sm text-text-muted">Total</span>
          <span className="text-base font-semibold tabular-nums text-text-primary">
            {currency.toUpperCase()} {fmt(total)}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={label}>Mode</span>
          <select className={input} value={mode} onChange={(e) => setMode(e.target.value as Mode | '')}>
            <option value="">Not stated</option>
            {MODES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Transit, days</span>
          <input
            className={input}
            inputMode="numeric"
            value={transitDays}
            onChange={(e) => setTransitDays(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        <label className="block">
          <span className={label}>Valid until</span>
          <input className={input} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          {pastValidity && (
            <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
              This date has passed. Check it against the document: it is often the quote date. A quote still past its
              validity cannot be priced or accepted.
            </span>
          )}
        </label>
      </div>

      <label className="block">
        <span className={label}>Exclusions and conditions</span>
        <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="flex gap-2">
        <button type="button" className={primaryButton} disabled={!ready || pending} onClick={save}>
          {pending ? <IconLoader2 size={15} className="animate-spin" /> : <IconCheck size={15} />} Save quote
        </button>
        <button type="button" className={secondaryButton} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default QuoteEditor;
