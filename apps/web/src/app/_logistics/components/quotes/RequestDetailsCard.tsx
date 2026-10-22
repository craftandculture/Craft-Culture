'use client';

import { IconCheck, IconPaperclip, IconPencil } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import { card, input, label, pillClass, primaryButton, secondaryButton, sectionHeading } from '../exports/exportUi';

type Request = inferRouterOutputs<AppRouter>['logistics']['admin']['requests']['getOne'];
type Mode = 'sea_fcl' | 'sea_lcl' | 'air' | 'road';

export interface RequestDetailsCardProps {
  request: Request;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

const MODE: Record<Mode, string> = {
  air: 'Air',
  sea_fcl: 'Sea, full container',
  sea_lcl: 'Sea, shared container',
  road: 'Road',
};

const day = (d: Date | null) =>
  d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
const num = (n: number | null, digits = 0) =>
  n == null ? null : n.toLocaleString('en-GB', { maximumFractionDigits: digits });
const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
const str = (n: number | null) => (n == null ? '' : String(n));

/** The form's values, all as typed */
const fromRequest = (r: Request) => ({
  originCountry: r.originCountry,
  originCity: r.originCity ?? '',
  originWarehouse: r.originWarehouse ?? '',
  destinationCountry: r.destinationCountry,
  destinationCity: r.destinationCity ?? '',
  destinationWarehouse: r.destinationWarehouse ?? '',
  transportMode: (r.transportMode ?? '') as Mode | '',
  productDescription: r.productDescription ?? '',
  totalCases: str(r.totalCases),
  totalBottles: str(r.totalBottles),
  total75clEquivalents: str(r.total75clEquivalents),
  totalPallets: str(r.totalPallets),
  totalWeightKg: str(r.totalWeightKg),
  totalVolumeM3: str(r.totalVolumeM3),
  targetPickupDate: isoDay(r.targetPickupDate),
  targetDeliveryDate: isoDay(r.targetDeliveryDate),
  replyBy: isoDay(r.replyBy),
  temperatureControlled: r.temperatureControlled,
  requiresThermalLiner: r.requiresThermalLiner,
  requiresTracker: r.requiresTracker,
  requiresInsurance: r.requiresInsurance,
  notes: r.notes ?? '',
  clientName: r.clientName ?? '',
  clientEmail: r.clientEmail ?? '',
});

type Form = ReturnType<typeof fromRequest>;

const toNumber = (v: string) => {
  const n = Number(v.replace(/,/g, ''));
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
};
const toInt = (v: string) => {
  const n = toNumber(v);
  return n == null ? null : Math.round(n);
};
const toDate = (v: string) => (v ? new Date(`${v}T12:00:00`) : null);

/**
 * What is being moved, from where to where, and for whom
 *
 * Reads as a summary; Edit turns the same card into its form, and Save turns
 * it back. Anything a later step needs and is missing (the bottle count for
 * prices per bottle, the size of the cargo for forwarders to quote at all) is
 * shown as a link that opens the form. While the job is still a draft, its
 * route and mode follow what is saved here.
 */
const RequestDetailsCard = ({ request, editing, onEditingChange }: RequestDetailsCardProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => fromRequest(request));

  // Start each edit from what is saved
  useEffect(() => {
    if (editing) setForm(fromRequest(request));
  }, [editing, request]);

  const { data: routeOptions } = useQuery({
    ...api.logistics.admin.requests.routeOptions.queryOptions(),
    enabled: editing,
  });

  const save = useMutation({
    ...api.logistics.admin.requests.update.mutationOptions(),
    onSuccess: () => {
      toast.success('Details saved');
      onEditingChange(false);
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests']] });
    },
    onError: (error) => toast.error(error.message || 'The details were not saved'),
  });

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    if (!form.originCountry.trim() || !form.destinationCountry.trim()) {
      toast.error('Both countries are needed');
      return;
    }
    const bottles = toInt(form.totalBottles);
    save.mutate({
      requestId: request.id,
      originCountry: form.originCountry.trim(),
      originCity: form.originCity.trim() || null,
      originWarehouse: form.originWarehouse.trim() || null,
      destinationCountry: form.destinationCountry.trim(),
      destinationCity: form.destinationCity.trim() || null,
      destinationWarehouse: form.destinationWarehouse.trim() || null,
      transportMode: form.transportMode || null,
      productDescription: form.productDescription.trim() || null,
      totalCases: toInt(form.totalCases),
      totalBottles: bottles,
      // Without a 75cl figure the bottles are taken as 75cl
      total75clEquivalents: toNumber(form.total75clEquivalents) ?? bottles,
      totalPallets: toInt(form.totalPallets),
      totalWeightKg: toNumber(form.totalWeightKg),
      totalVolumeM3: toNumber(form.totalVolumeM3),
      targetPickupDate: toDate(form.targetPickupDate),
      targetDeliveryDate: toDate(form.targetDeliveryDate),
      replyBy: toDate(form.replyBy),
      temperatureControlled: form.temperatureControlled,
      requiresThermalLiner: form.requiresThermalLiner,
      requiresTracker: form.requiresTracker,
      requiresInsurance: form.requiresInsurance,
      notes: form.notes.trim() || null,
      clientName: form.clientName.trim() || null,
      clientEmail: form.clientEmail.trim() || null,
    });
  };

  const header = (
    <div className="flex items-center gap-2">
      <span className={sectionHeading}>Details</span>
      {!editing && (
        <button type="button" className={`${secondaryButton} ml-auto`} onClick={() => onEditingChange(true)}>
          <IconPencil size={15} /> Edit
        </button>
      )}
    </div>
  );

  if (editing) {
    const text = (key: keyof Form, title: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
      <label className="block">
        <span className={label}>{title}</span>
        <input
          className={input}
          value={form[key] as string}
          onChange={(e) => set(key, e.target.value as never)}
          {...extra}
        />
      </label>
    );
    const tick = (key: keyof Form, title: string) => (
      <label className="flex items-center gap-1.5 text-sm text-text-primary">
        <input type="checkbox" checked={form[key] as boolean} onChange={(e) => set(key, e.target.checked as never)} />
        {title}
      </label>
    );

    return (
      <div id="request-details" className={`${card} space-y-5 p-4`}>
        {header}
        <datalist id="details-countries">
          {routeOptions?.countries.map((c) => <option key={c} value={c} />)}
        </datalist>
        <datalist id="details-cities">
          {routeOptions?.cities.map((c) => <option key={c} value={c} />)}
        </datalist>
        <datalist id="details-warehouses">
          {routeOptions?.warehouses.map((w) => <option key={w} value={w} />)}
        </datalist>

        <div className="grid gap-3 sm:grid-cols-3">
          {text('originCountry', 'From: country', { list: 'details-countries' })}
          {text('originCity', 'City', { list: 'details-cities' })}
          {text('originWarehouse', 'Warehouse', { list: 'details-warehouses' })}
          {text('destinationCountry', 'To: country', { list: 'details-countries' })}
          {text('destinationCity', 'City', { list: 'details-cities' })}
          {text('destinationWarehouse', 'Warehouse', { list: 'details-warehouses' })}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className={label}>Mode</span>
            <select
              className={input}
              value={form.transportMode}
              onChange={(e) => set('transportMode', e.target.value as Mode | '')}
            >
              <option value="">Air or sea: ask for both</option>
              {(Object.keys(MODE) as Mode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE[m]}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">{text('productDescription', 'Goods', { placeholder: 'e.g. Fine wine, Burgundy' })}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          {text('totalCases', 'Cases', { inputMode: 'numeric' })}
          {text('totalBottles', 'Bottles', { inputMode: 'numeric', autoFocus: !request.totalBottles })}
          {text('total75clEquivalents', '75cl equivalent', { inputMode: 'decimal', placeholder: 'Same as bottles' })}
          {text('totalPallets', 'Pallets', { inputMode: 'numeric' })}
          {text('totalWeightKg', 'Weight, kg', { inputMode: 'decimal' })}
          {text('totalVolumeM3', 'Volume, m³', { inputMode: 'decimal' })}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {text('targetPickupDate', 'Ready for collection', { type: 'date' })}
          {text('targetDeliveryDate', 'Needed by', { type: 'date' })}
          {text('replyBy', 'Forwarders reply by', { type: 'date' })}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {tick('temperatureControlled', 'Temperature-managed')}
          {tick('requiresThermalLiner', 'Thermal liner')}
          {tick('requiresTracker', 'Tracker')}
          {tick('requiresInsurance', 'Insurance quoted separately')}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {text('clientName', 'Client, as greeted', { placeholder: 'e.g. Mr Smith' })}
          {text('clientEmail', 'Client email', { type: 'email', placeholder: 'For sending the client their quote' })}
        </div>

        <label className="block">
          <span className={label}>Notes for the forwarders</span>
          <textarea
            className={`${input} h-20 py-2`}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </label>

        <div className="flex gap-2">
          <button type="button" className={primaryButton} disabled={save.isPending} onClick={submit}>
            <IconCheck size={15} /> Save
          </button>
          <button type="button" className={secondaryButton} onClick={() => onEditingChange(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const r = request;
  const sized = !!(r.totalCases || r.totalBottles || r.totalPallets || r.totalWeightKg);
  const facts = [
    { label: 'Mode', value: r.transportMode ? MODE[r.transportMode] : 'Air or sea' },
    { label: 'Cases', value: num(r.totalCases) },
    { label: 'Bottles', value: num(r.totalBottles) },
    {
      label: '75cl equivalent',
      value: r.total75clEquivalents && r.total75clEquivalents !== r.totalBottles ? num(r.total75clEquivalents) : null,
    },
    { label: 'Pallets', value: num(r.totalPallets) },
    { label: 'Weight', value: r.totalWeightKg ? `${num(r.totalWeightKg)} kg` : null },
    { label: 'Volume', value: r.totalVolumeM3 ? `${num(r.totalVolumeM3, 1)} m³` : null },
    { label: 'Ready', value: day(r.targetPickupDate) },
    { label: 'Needed by', value: day(r.targetDeliveryDate) },
    { label: 'Replies by', value: day(r.replyBy) },
    { label: 'Client', value: [r.clientName, r.clientEmail].filter(Boolean).join(' · ') || null },
  ].filter((f): f is { label: string; value: string } => !!f.value);

  const range =
    r.minTemperature != null && r.maxTemperature != null ? ` ${r.minTemperature}–${r.maxTemperature}°C` : '';
  const needs = [
    (r.temperatureControlled || r.requiresThermalLiner) && `Temperature-managed${range}`,
    r.requiresThermalLiner && 'Thermal liner',
    r.requiresTracker && 'Tracker',
    r.requiresInsurance && 'Insurance quoted separately',
  ].filter((n): n is string => !!n);

  const missing = [
    !sized && 'the cases, bottles or weight (forwarders cannot quote without them)',
    sized && !r.totalBottles && 'the bottle count (for prices per bottle)',
    !r.clientName && !r.clientEmail && "the client's name and email (for their quote)",
  ].filter((m): m is string => !!m);

  return (
    <div id="request-details" className={`${card} space-y-3 p-4`}>
      {header}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-[11px] text-text-muted">{f.label}</dt>
            <dd className="text-sm font-medium tabular-nums text-text-primary">{f.value}</dd>
          </div>
        ))}
      </dl>
      {(needs.length > 0 || r.productDescription) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {r.productDescription && <span className="mr-1 text-sm text-text-primary">{r.productDescription}</span>}
          {needs.map((n) => (
            <span key={n} className={pillClass('slate')}>
              {n}
            </span>
          ))}
        </div>
      )}
      {r.notes && <p className="whitespace-pre-wrap text-sm text-text-muted">{r.notes}</p>}
      {r.attachments.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {r.attachments.map((a) => (
            <a
              key={a.id}
              href={a.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-text-primary underline"
            >
              <IconPaperclip size={14} /> {a.fileName}
            </a>
          ))}
        </div>
      )}
      {missing.length > 0 && r.status !== 'cancelled' && (
        <button
          type="button"
          onClick={() => onEditingChange(true)}
          className="block text-left text-sm text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
        >
          Add {missing.join('; ')}
        </button>
      )}
    </div>
  );
};

export default RequestDetailsCard;
