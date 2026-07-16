'use client';

import {
  IconArrowLeft,
  IconCalculator,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

const CATEGORIES = [
  'freight',
  'collection',
  'customs',
  'handling',
  'security',
  'documentation',
  'insurance',
  'duty',
  'delivery',
  'other',
] as const;
type Category = (typeof CATEGORIES)[number];

interface ParsedCandidate {
  category: string;
  description: string;
  amount: number;
  currency: string;
  scope: 'shared' | 'shipment';
  shipmentId: string | null;
  shipmentMatch: string | null;
}
interface ParsedResult {
  vendor: string | null;
  invoiceRef: string | null;
  invoiceDate: string | null;
  currency: string;
  chargeableWeightKg: number | null;
  candidates: ParsedCandidate[];
}

const fmtUsd = (v: number | null | undefined) =>
  v == null ? '—' : `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const bottlesOf = (i: { totalBottles: number | null; cases: number; bottlesPerCase: number | null }) =>
  i.totalBottles ?? i.cases * (i.bottlesPerCase ?? 12);

const selectCls =
  'rounded-lg border border-border-primary bg-background-primary px-2.5 py-2 text-sm text-text-primary focus:border-border-brand focus:outline-none';

// USD-pegged currencies convert at a fixed rate; floating ones default to 1
// and must be set manually.
const PEGGED_FX: Record<string, string> = {
  USD: '1',
  AED: '0.2723',
  SAR: '0.2667',
  QAR: '0.2747',
  BHD: '2.6539',
  OMR: '2.6008',
};
const defaultFxFor = (currency: string) => PEGGED_FX[currency] ?? '1';

const DOC_TYPES = [
  'airway_bill',
  'bill_of_lading',
  'commercial_invoice',
  'packing_list',
  'shipping_invoice',
  'gac_invoice',
  'customs_declaration',
  'certificate_of_origin',
  'delivery_note',
  'insurance_certificate',
  'other',
] as const;
type DocType = (typeof DOC_TYPES)[number];
const docLabel = (t: string) => t.replace(/_/g, ' ');

/**
 * Soft tint palette to visually separate each supplier invoice in the cost
 * ledger — cycled by invoice index so adjacent invoices read as distinct.
 */
const LEDGER_TINTS = [
  {
    card: 'border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-900/10',
    accent: 'border-l-blue-400',
    dot: 'bg-blue-400',
  },
  {
    card: 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10',
    accent: 'border-l-amber-400',
    dot: 'bg-amber-400',
  },
  {
    card: 'border-violet-200 bg-violet-50/60 dark:border-violet-900/40 dark:bg-violet-900/10',
    accent: 'border-l-violet-400',
    dot: 'bg-violet-400',
  },
  {
    card: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/10',
    accent: 'border-l-emerald-400',
    dot: 'bg-emerald-400',
  },
  {
    card: 'border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-900/10',
    accent: 'border-l-rose-400',
    dot: 'bg-rose-400',
  },
  {
    card: 'border-teal-200 bg-teal-50/60 dark:border-teal-900/40 dark:bg-teal-900/10',
    accent: 'border-l-teal-400',
    dot: 'bg-teal-400',
  },
] as const;

/** Inline-editable supplier/vendor label for an invoice ledger header. */
const InvoiceVendorField = ({
  vendor,
  onSave,
}: {
  vendor: string | null;
  onSave: (v: string | null) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(vendor ?? '');

  if (editing) {
    return (
      <form
        className="flex items-center gap-1"
        onClick={(e) => e.preventDefault()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft.trim() || null);
          setEditing(false);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Supplier name"
          autoFocus
          className="w-52 rounded border border-border-primary bg-background-primary px-1.5 py-0.5 text-sm focus:border-border-brand focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(vendor ?? '');
              setEditing(false);
            }
          }}
        />
        <button
          type="submit"
          className="rounded bg-fill-brand px-2 py-0.5 text-[11px] font-medium text-white hover:bg-fill-brand/90"
        >
          Save
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        setDraft(vendor ?? '');
        setEditing(true);
      }}
      className="group/v inline-flex items-center gap-1 hover:underline"
      title="Set supplier"
    >
      {vendor ? (
        <span className="truncate font-semibold text-text-primary">{vendor}</span>
      ) : (
        <span className="text-xs font-medium text-text-muted/60">+ Add supplier</span>
      )}
      <IconPencil className="h-3 w-3 opacity-0 transition-opacity group-hover/v:opacity-60" />
    </button>
  );
};

const ShipmentGroupDetailPage = () => {
  const api = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const groupId = params.groupId as string;

  const { data, isLoading } = useQuery(
    api.logistics.admin.groups.getOne.queryOptions({ id: groupId }),
  );
  const { data: inboundData } = useQuery(
    api.logistics.admin.getMany.queryOptions({ type: 'inbound', limit: 100 }),
  );

  const [weightKg, setWeightKg] = useState('');
  const [line, setLine] = useState({
    category: 'freight' as Category,
    description: '',
    amount: '',
    currency: 'USD',
    fxToUsd: '1',
    scope: 'shared' as 'shared' | 'shipment',
    shipmentId: '',
  });

  useEffect(() => {
    if (data?.group) setWeightKg(data.group.chargeableWeightKg?.toString() ?? '');
  }, [data?.group]);

  const memberIds = useMemo(() => new Set(data?.shipments.map((s) => s.id) ?? []), [data]);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: api.logistics.admin.groups.getOne.queryKey() }),
      queryClient.invalidateQueries({ queryKey: api.logistics.admin.groups.getMany.queryKey() }),
    ]);

  const updateMut = useMutation({
    ...api.logistics.admin.groups.update.mutationOptions(),
    onSuccess: () => void invalidate(),
    onError: () => toast.error('Save failed'),
  });
  const addLineMut = useMutation({
    ...api.logistics.admin.groups.addCostLine.mutationOptions(),
    onSuccess: () => {
      void invalidate();
      setLine((l) => ({ ...l, description: '', amount: '' }));
      toast.success('Cost added');
    },
    onError: () => toast.error('Failed to add cost'),
  });
  const delLineMut = useMutation({
    ...api.logistics.admin.groups.deleteCostLine.mutationOptions(),
    onSuccess: () => void invalidate(),
  });
  const setVendorMut = useMutation({
    ...api.logistics.admin.groups.setInvoiceVendor.mutationOptions(),
    onSuccess: () => {
      void invalidate();
      toast.success('Supplier updated');
    },
    onError: () => toast.error('Failed to update supplier'),
  });
  const calcMut = useMutation({
    ...api.logistics.admin.groups.calculate.mutationOptions(),
    onSuccess: (r) => {
      void invalidate();
      toast.success(
        `Applied ${fmtUsd(r.totalFreight)} logistics across ${r.totalBottles.toLocaleString()} bottles`,
      );
    },
    onError: (e) => toast.error(e.message || 'Allocation failed'),
  });
  const deleteMut = useMutation({
    ...api.logistics.admin.groups.delete.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: api.logistics.admin.groups.getMany.queryKey(),
      });
      router.push('/platform/admin/logistics/groups');
    },
  });

  // ── Invoice upload + auto-parse ──────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [batchFx, setBatchFx] = useState('1');
  const [savingBatch, setSavingBatch] = useState(false);

  const parseMut = useMutation({
    ...api.logistics.admin.groups.parseInvoice.mutationOptions(),
    onSuccess: (r) => {
      setParsed(r);
      setBatchFx(defaultFxFor(r.currency));
      if (r.chargeableWeightKg && !weightKg) setWeightKg(String(r.chargeableWeightKg));
      toast.success(`Found ${r.candidates.length} charge lines`);
    },
    onError: (e) => toast.error(e.message || 'Could not parse invoice'),
  });

  const handleFile = (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    const fileType = f.type;
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'].includes(fileType)) {
      toast.error('Upload a PDF, PNG or JPG');
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      parseMut.mutate({
        groupId,
        file: reader.result as string,
        fileType: fileType as 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/jpg',
      });
    reader.readAsDataURL(f);
  };

  // ── Group documents (upload once, applies to all shipments) ──────────────
  const docFileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocType>('airway_bill');
  const uploadDocMut = useMutation({
    ...api.logistics.admin.groups.uploadDocument.mutationOptions(),
    onSuccess: () => {
      void invalidate();
      toast.success('Document uploaded — applies to all shipments');
    },
    onError: (e) => toast.error(e.message || 'Upload failed'),
  });
  const delDocMut = useMutation({
    ...api.logistics.admin.groups.deleteDocument.mutationOptions(),
    onSuccess: () => void invalidate(),
  });
  const handleDocFile = (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () =>
      uploadDocMut.mutate({
        groupId,
        file: reader.result as string,
        filename: f.name,
        documentType: docType,
      });
    reader.readAsDataURL(f);
  };

  const addAllParsed = async () => {
    if (!parsed) return;
    setSavingBatch(true);
    const fx = Number(batchFx) || 1;
    try {
      for (const c of parsed.candidates) {
        await addLineMut.mutateAsync({
          groupId,
          category: c.category as Category,
          description: c.description || null,
          amount: c.amount,
          currency: c.currency,
          fxToUsd: fx,
          scope: c.scope,
          shipmentId: c.scope === 'shipment' ? c.shipmentId : null,
          invoiceRef: parsed.invoiceRef,
          vendor: parsed.vendor,
          sourceDocument: parsed.vendor,
        });
      }
      if (parsed.chargeableWeightKg) {
        updateMut.mutate({ id: groupId, chargeableWeightKg: parsed.chargeableWeightKg });
      }
      toast.success(`Added ${parsed.candidates.length} cost lines`);
      setParsed(null);
      void invalidate();
    } finally {
      setSavingBatch(false);
    }
  };

  const toggleShipment = (shipmentId: string) => {
    const next = new Set(memberIds);
    if (next.has(shipmentId)) next.delete(shipmentId);
    else next.add(shipmentId);
    updateMut.mutate(
      { id: groupId, shipmentIds: Array.from(next) },
      { onSuccess: () => toast.success('Shipments updated') },
    );
  };

  const addLine = () => {
    const amount = Number(line.amount);
    if (!amount) return;
    addLineMut.mutate({
      groupId,
      category: line.category,
      description: line.description.trim() || null,
      amount,
      currency: line.currency,
      fxToUsd: Number(line.fxToUsd) || 1,
      scope: line.scope,
      shipmentId: line.scope === 'shipment' ? line.shipmentId || null : null,
    });
  };

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <IconLoader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  const { group, shipments, totalBottles, totalCases, totalProductCost, costLines, metrics, documents } =
    data;
  const goods = totalProductCost;
  const logistics = metrics.totalLogisticsUsd;
  const landed = goods + logistics;

  return (
    <main className="container py-6 md:py-10">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/platform/admin/logistics/groups">
              <Button variant="ghost" size="sm">
                <ButtonContent iconLeft={IconArrowLeft}>Groups</ButtonContent>
              </Button>
            </Link>
            <div>
              <Typography variant="headingSm">{group.name}</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                {group.reference ? `${group.reference} · ` : ''}
                {shipments.length} shipments · {totalCases.toLocaleString()} cases ·{' '}
                {totalBottles.toLocaleString()} bottles
              </Typography>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('Delete this group? Shipments will be unassigned.'))
                deleteMut.mutate({ id: groupId });
            }}
          >
            <ButtonContent iconLeft={IconTrash}>Delete</ButtonContent>
          </Button>
        </div>

        {/* Shipments in this group */}
        <Card>
          <CardContent className="gap-3 p-4">
            <Typography variant="labelSm">Shipments in this group</Typography>
            {shipments.length === 0 ? (
              <Typography variant="bodyXs" colorRole="muted">
                No shipments yet — tick inbound shipments below to add them.
              </Typography>
            ) : (
              <div className="divide-y divide-border-muted">
                {shipments.map((s) => {
                  const bottles = s.items.reduce((sum, i) => sum + bottlesOf(i), 0);
                  const freight = s.items.reduce((sum, i) => sum + (i.freightAllocated ?? 0), 0);
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <Typography variant="labelSm" className="truncate">
                          {s.shipmentNumber} {s.name ? `· ${s.name}` : ''}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {s.items.length} lines · {bottles.toLocaleString()} bottles
                          {freight > 0 ? ` · logistics ${fmtUsd(freight)}` : ''}
                        </Typography>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => toggleShipment(s.id)}>
                        <ButtonContent>Remove</ButtonContent>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add inbound shipments */}
        <Card>
          <CardContent className="gap-3 p-4">
            <Typography variant="labelSm">Add inbound shipments</Typography>
            <div className="max-h-56 divide-y divide-border-muted overflow-y-auto">
              {(inboundData?.data ?? [])
                .filter((s) => !memberIds.has(s.id))
                .map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 py-2 hover:bg-fill-primary-hover"
                  >
                    <input type="checkbox" checked={false} onChange={() => toggleShipment(s.id)} className="h-4 w-4" />
                    <div className="min-w-0 flex-1">
                      <Typography variant="bodySm" className="truncate">
                        {s.shipmentNumber} {s.name ? `· ${s.name}` : ''}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        {s.totalCases} cases · {s.totalBottles} bottles
                        {s.groupId && s.groupId !== groupId ? ' · in another group' : ''}
                      </Typography>
                    </div>
                  </label>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Group documents — upload once, applies to every shipment */}
        <Card>
          <CardContent className="gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Typography variant="labelSm">Documents</Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Upload the AWB or a shared doc once — it shows on all {shipments.length} shipments
                </Typography>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocType)}
                  className={`${selectCls} capitalize`}
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">
                      {docLabel(t)}
                    </option>
                  ))}
                </select>
                <input
                  ref={docFileRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    handleDocFile(e.target.files);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => docFileRef.current?.click()}
                  disabled={uploadDocMut.isPending}
                >
                  <ButtonContent iconLeft={uploadDocMut.isPending ? IconLoader2 : IconUpload}>
                    {uploadDocMut.isPending ? 'Uploading…' : 'Upload'}
                  </ButtonContent>
                </Button>
              </div>
            </div>
            {documents.length > 0 && (
              <div className="divide-y divide-border-muted">
                {documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 py-1.5">
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 truncate text-sm text-text-brand hover:underline"
                    >
                      &#x1F4C4; {d.fileName}
                    </a>
                    <div className="flex items-center gap-2">
                      <Typography variant="bodyXs" colorRole="muted" className="capitalize">
                        {docLabel(d.documentType)}
                      </Typography>
                      <button
                        onClick={() => delDocMut.mutate({ id: d.id })}
                        className="text-text-muted hover:text-red-500"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logistics cost ledger */}
        <Card>
          <CardContent className="gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Typography variant="labelSm">Logistics cost ledger</Typography>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    handleFile(e.target.files);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={parseMut.isPending}
                >
                  <ButtonContent iconLeft={parseMut.isPending ? IconLoader2 : IconUpload}>
                    {parseMut.isPending ? 'Parsing…' : 'Upload invoice'}
                  </ButtonContent>
                </Button>
                <Typography variant="bodyXs" colorRole="muted">
                  AWB kg
                </Typography>
                <input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  onBlur={() =>
                    updateMut.mutate({
                      id: groupId,
                      chargeableWeightKg: weightKg.trim() === '' ? null : Number(weightKg),
                    })
                  }
                  className={`${selectCls} w-20 text-right`}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Parsed-invoice review */}
            {parsed && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <Typography variant="labelSm">
                    <IconSparkles className="mr-1 inline h-3.5 w-3.5 text-violet-500" />
                    {parsed.candidates.length} charges parsed
                    {parsed.vendor ? ` · ${parsed.vendor}` : ''}
                    {parsed.invoiceRef ? ` · ${parsed.invoiceRef}` : ''}
                  </Typography>
                  <div className="flex items-center gap-2">
                    <Typography variant="bodyXs" colorRole="muted">
                      {parsed.currency}→USD FX
                    </Typography>
                    <input
                      type="number"
                      value={batchFx}
                      onChange={(e) => setBatchFx(e.target.value)}
                      className={`${selectCls} w-20 text-right ${
                        parsed.currency !== 'USD' && Number(batchFx) === 1
                          ? 'border-red-400 bg-red-50'
                          : ''
                      }`}
                    />
                  </div>
                </div>
                {parsed.currency !== 'USD' && Number(batchFx) === 1 && (
                  <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1">
                    <Typography variant="bodyXs" className="text-red-600">
                      Amounts are in {parsed.currency} but the FX rate is 1 — set the{' '}
                      {parsed.currency}→USD rate before adding, or they&apos;ll be treated as USD.
                    </Typography>
                  </div>
                )}
                <div className="max-h-52 divide-y divide-violet-100 overflow-y-auto">
                  {parsed.candidates.map((c, i) => {
                    const shp = shipments.find((s) => s.id === c.shipmentId);
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 py-1">
                        <Typography variant="bodyXs" className="truncate">
                          <span className="capitalize">{c.category}</span> · {c.description}
                          {c.scope === 'shipment'
                            ? ` → ${shp?.shipmentNumber ?? c.shipmentMatch ?? '?'}`
                            : ''}
                        </Typography>
                        <div className="flex items-center gap-2">
                          <Typography variant="bodyXs">
                            {c.currency} {c.amount.toLocaleString()}
                          </Typography>
                          <button
                            onClick={() =>
                              setParsed((p) =>
                                p
                                  ? { ...p, candidates: p.candidates.filter((_, j) => j !== i) }
                                  : p,
                              )
                            }
                            className="text-text-muted hover:text-red-500"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setParsed(null)}>
                    <ButtonContent>Discard</ButtonContent>
                  </Button>
                  <Button
                    size="sm"
                    onClick={addAllParsed}
                    disabled={savingBatch || parsed.candidates.length === 0}
                  >
                    <ButtonContent iconLeft={savingBatch ? IconLoader2 : IconPlus}>
                      Add {parsed.candidates.length} lines
                    </ButtonContent>
                  </Button>
                </div>
              </div>
            )}

            {/* Cost lines, grouped by supplier invoice — colour-coded cards */}
            {costLines.length > 0 && (
              <div className="space-y-2.5">
                {(() => {
                  const byDoc = new Map<string, typeof costLines>();
                  for (const l of costLines) {
                    const key = l.invoiceRef || l.sourceDocument || 'Manual entry';
                    const arr = byDoc.get(key) ?? [];
                    arr.push(l);
                    byDoc.set(key, arr);
                  }
                  return Array.from(byDoc.entries()).map(([doc, lines], gi) => {
                    const subtotal = lines.reduce((s, l) => s + l.amountUsd, 0);
                    const cur = lines[0]?.currency ?? 'USD';
                    const fx = lines[0]?.fxToUsd;
                    const tint =
                      LEDGER_TINTS[gi % LEDGER_TINTS.length] ?? LEDGER_TINTS[0];
                    return (
                      <div
                        key={doc}
                        className={`overflow-hidden rounded-lg border border-l-4 ${tint.card} ${tint.accent}`}
                      >
                        {/* Invoice header */}
                        <div className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`mt-1 h-2 w-2 shrink-0 self-start rounded-full ${tint.dot}`} />
                            <div className="min-w-0">
                              <InvoiceVendorField
                                vendor={lines[0]?.vendor ?? null}
                                onSave={(v) =>
                                  setVendorMut.mutate({ groupId, docKey: doc, vendor: v })
                                }
                              />
                              <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                                <span className="truncate font-mono">{doc}</span>
                                {cur !== 'USD' && (
                                  <span className="shrink-0">
                                    · {cur} @ {fx}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <Typography variant="labelSm" className="tabular-nums">
                              {fmtUsd(subtotal)}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              {lines.length} {lines.length === 1 ? 'line' : 'lines'}
                            </Typography>
                          </div>
                        </div>
                        {/* Line items on a clean surface for readability */}
                        <div className="divide-y divide-border-muted/60 border-t border-border-muted/60 bg-surface-primary/70">
                          {lines.map((l) => {
                            const shp = shipments.find((s) => s.id === l.shipmentId);
                            return (
                              <div
                                key={l.id}
                                className="flex items-center justify-between gap-3 px-3 py-2"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary dark:bg-white/10">
                                    {l.category}
                                  </span>
                                  <div className="min-w-0">
                                    <Typography variant="bodySm" className="truncate">
                                      {l.description || (
                                        <span className="capitalize">{l.category}</span>
                                      )}
                                    </Typography>
                                    <Typography
                                      variant="bodyXs"
                                      colorRole="muted"
                                      className="truncate"
                                    >
                                      {l.currency} {l.amount.toLocaleString()}
                                      {l.scope === 'shipment'
                                        ? ` · ${shp?.shipmentNumber ?? 'shipment'}`
                                        : ' · shared'}
                                    </Typography>
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <Typography variant="labelSm" className="tabular-nums">
                                    {fmtUsd(l.amountUsd)}
                                  </Typography>
                                  <button
                                    onClick={() => delLineMut.mutate({ id: l.id })}
                                    className="text-text-muted hover:text-red-500"
                                    aria-label="Delete cost line"
                                  >
                                    <IconTrash className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
                <div className="flex items-center justify-between border-t-2 border-border-primary pt-2.5">
                  <Typography variant="labelSm">Total logistics</Typography>
                  <Typography variant="labelSm" className="tabular-nums">
                    {fmtUsd(metrics.totalLogisticsUsd)}
                  </Typography>
                </div>
              </div>
            )}

            {/* Add line */}
            <div className="flex flex-wrap items-end gap-2 border-t border-border-muted pt-3">
              <select
                value={line.category}
                onChange={(e) => setLine((l) => ({ ...l, category: e.target.value as Category }))}
                className={`${selectCls} capitalize`}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">
                    {c}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Description"
                value={line.description}
                onChange={(e) => setLine((l) => ({ ...l, description: e.target.value }))}
                className="min-w-[140px] flex-1"
              />
              <input
                type="number"
                placeholder="Amount"
                value={line.amount}
                onChange={(e) => setLine((l) => ({ ...l, amount: e.target.value }))}
                className={`${selectCls} w-24 text-right`}
              />
              <select
                value={line.currency}
                onChange={(e) => setLine((l) => ({ ...l, currency: e.target.value }))}
                className={selectCls}
              >
                {['USD', 'GBP', 'EUR', 'AED'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="FX→USD"
                value={line.fxToUsd}
                onChange={(e) => setLine((l) => ({ ...l, fxToUsd: e.target.value }))}
                title="FX rate to USD at time of conversion"
                className={`${selectCls} w-20 text-right`}
              />
              <select
                value={line.scope}
                onChange={(e) =>
                  setLine((l) => ({ ...l, scope: e.target.value as 'shared' | 'shipment' }))
                }
                className={selectCls}
              >
                <option value="shared">Shared</option>
                <option value="shipment">Per-shipment</option>
              </select>
              {line.scope === 'shipment' && (
                <select
                  value={line.shipmentId}
                  onChange={(e) => setLine((l) => ({ ...l, shipmentId: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">Shipment…</option>
                  {shipments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shipmentNumber}
                    </option>
                  ))}
                </select>
              )}
              <Button onClick={addLine} disabled={!line.amount || addLineMut.isPending}>
                <ButtonContent iconLeft={addLineMut.isPending ? IconLoader2 : IconPlus}>Add</ButtonContent>
              </Button>
            </div>

            <div className="flex justify-end border-t border-border-muted pt-3">
              <Button
                onClick={() => calcMut.mutate({ id: groupId })}
                disabled={calcMut.isPending || shipments.length === 0 || costLines.length === 0}
              >
                <ButtonContent iconLeft={calcMut.isPending ? IconLoader2 : IconCalculator}>
                  Calculate &amp; apply
                </ButtonContent>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardContent className="gap-2 p-4">
            <div className="flex flex-row flex-wrap items-center justify-around gap-4 text-center">
              {[
                { v: fmtUsd(goods), label: 'Goods (product) cost' },
                { v: fmtUsd(logistics), label: 'Logistics (freight etc.)' },
                { v: fmtUsd(landed), label: 'Total landed cost' },
                { v: fmtUsd(metrics.perBottle), label: 'Logistics / 75cl btl' },
                { v: fmtUsd(metrics.perCase), label: 'Logistics / case' },
                {
                  v: metrics.perKg != null ? `${fmtUsd(metrics.perKg)}/kg` : '—',
                  label: 'Logistics / kg',
                },
              ].map((t) => (
                <div key={t.label}>
                  <Typography variant="headingSm">{t.v}</Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    {t.label}
                  </Typography>
                </div>
              ))}
            </div>
            <Typography variant="bodyXs" colorRole="muted" className="text-center">
              {group.allocatedAt
                ? 'Applied to items — landed cost is written onto each bottle for pricing.'
                : 'Live preview. Hit “Calculate & apply” to write landed cost onto each bottle.'}
            </Typography>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default ShipmentGroupDetailPage;
