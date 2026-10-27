'use client';

import { IconChevronRight, IconInfoCircle } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { type ShipmentType, shipmentTypeConfig } from '@/app/_logistics/components/ShipmentTypeBadge';
import useTRPC from '@/lib/trpc/browser';

type TransportMode = 'sea_fcl' | 'sea_lcl' | 'air' | 'road';

// Re-export is no longer offered: mainland transfers took its place
const TYPES: ShipmentType[] = ['inbound', 'outbound', 'mainland_transfer'];

const MODES: { key: TransportMode; label: string }[] = [
  { key: 'air', label: 'Air' },
  { key: 'sea_fcl', label: 'Sea FCL' },
  { key: 'sea_lcl', label: 'Sea LCL' },
  { key: 'road', label: 'Road' },
];

/** Where each kind of shipment usually starts and ends, so the form opens filled */
const ROUTE_DEFAULTS: Record<
  ShipmentType,
  { originCountry: string; originCity: string; destinationCountry: string; destinationCity: string; destinationWarehouse: string }
> = {
  inbound: { originCountry: '', originCity: '', destinationCountry: 'UAE', destinationCity: 'Ras Al Khaimah', destinationWarehouse: 'C&C warehouse' },
  outbound: { originCountry: 'UAE', originCity: 'Ras Al Khaimah', destinationCountry: '', destinationCity: '', destinationWarehouse: '' },
  re_export: { originCountry: 'UAE', originCity: 'Ras Al Khaimah', destinationCountry: '', destinationCity: '', destinationWarehouse: '' },
  mainland_transfer: { originCountry: 'UAE', originCity: 'Ras Al Khaimah', destinationCountry: 'UAE', destinationCity: '', destinationWarehouse: '' },
};

const input =
  'h-10 w-full rounded-lg border border-border-muted bg-surface-primary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-text-primary focus:outline-none';
const label = 'mb-1 block text-xs font-medium text-text-muted';
const pill = (on: boolean) =>
  `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    on ? 'bg-text-primary text-surface-primary' : 'bg-surface-secondary text-text-muted hover:text-text-primary'
  }`;

/**
 * Open a shipment
 *
 * The type sets the route it opens with and the references it asks for: an air
 * shipment wants an AWB, a sea one a container and BL. Exports and mainland
 * transfers are pointed to an export job, which carries the invoice and bond.
 * Everything here can be changed on the shipment afterwards.
 */
const NewShipmentPage = () => {
  const router = useRouter();
  const api = useTRPC();
  const { data: partners } = useQuery(api.partners.getMany.queryOptions({ limit: 1000 }));

  const [type, setType] = useState<ShipmentType>('inbound');
  const [transportMode, setTransportMode] = useState<TransportMode>('air');
  const [form, setForm] = useState({
    name: '',
    partnerId: '',
    ...ROUTE_DEFAULTS.inbound,
    carrierName: '',
    carrierBookingRef: '',
    containerNumber: '',
    blNumber: '',
    awbNumber: '',
    etd: '',
    eta: '',
    internalNotes: '',
  });
  const set = (field: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const chooseType = (next: ShipmentType) => {
    setType(next);
    setForm((prev) => ({ ...prev, ...ROUTE_DEFAULTS[next] }));
    if (next === 'mainland_transfer') setTransportMode('road');
  };

  const { mutate: createShipment, isPending } = useMutation(
    api.logistics.admin.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Shipment ${data.shipmentNumber} created`);
        router.push(`/platform/admin/logistics/shipments/${data.id}`);
      },
      onError: (error) => toast.error(error.message || 'Failed to create shipment'),
    }),
  );

  const opt = (v: string) => v.trim() || undefined;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sea = transportMode === 'sea_fcl' || transportMode === 'sea_lcl';
    createShipment({
      name: opt(form.name),
      type,
      transportMode,
      partnerId: opt(form.partnerId),
      originCountry: opt(form.originCountry),
      originCity: opt(form.originCity),
      destinationCountry: opt(form.destinationCountry),
      destinationCity: opt(form.destinationCity),
      destinationWarehouse: form.destinationWarehouse.trim(),
      carrierName: opt(form.carrierName),
      carrierBookingRef: opt(form.carrierBookingRef),
      containerNumber: sea ? opt(form.containerNumber) : undefined,
      blNumber: sea ? opt(form.blNumber) : undefined,
      awbNumber: transportMode === 'air' ? opt(form.awbNumber) : undefined,
      etd: form.etd ? new Date(form.etd) : undefined,
      eta: form.eta ? new Date(form.eta) : undefined,
      internalNotes: opt(form.internalNotes),
    });
  };

  const field = (key: keyof typeof form, text: string, extra?: { type?: string; placeholder?: string; span?: boolean }) => (
    <div className={extra?.span ? 'sm:col-span-2' : undefined}>
      <label htmlFor={key} className={label}>
        {text}
      </label>
      <input
        id={key}
        type={extra?.type ?? 'text'}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={extra?.placeholder}
        className={input}
      />
    </div>
  );

  const section = 'space-y-4 rounded-xl border border-border-muted bg-surface-primary p-5';
  const heading = 'text-sm font-semibold text-text-primary';

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-sm text-text-muted">
            <Link href="/platform/admin/logistics/shipments" className="transition-colors hover:text-text-primary">
              Shipments
            </Link>
            <IconChevronRight className="size-4" />
            <span className="text-text-primary">New shipment</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">New shipment</h1>
          <p className="mt-0.5 text-sm text-text-muted">Hillebrand shipments arrive on their own with Sync; open one here for anything else.</p>
        </div>

        <section className={section}>
          <p className={heading}>The shipment</p>
          <div>
            <span className={label}>Type</span>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button key={t} type="button" className={pill(type === t)} onClick={() => chooseType(t)}>
                  {shipmentTypeConfig[t].label}
                </button>
              ))}
            </div>
          </div>
          {type === 'outbound' || type === 'mainland_transfer' ? (
            <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-900">
              <IconInfoCircle size={18} className="mt-0.5 shrink-0" />
              <span>
                Exports and mainland transfers are best opened as an{' '}
                <Link href="/platform/admin/logistics/exports/new" className="font-medium underline underline-offset-2">
                  export job
                </Link>
                , which carries the client, the invoice and any movement bond.
              </span>
            </div>
          ) : null}
          <div>
            <span className={label}>Mode</span>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button key={m.key} type="button" className={pill(transportMode === m.key)} onClick={() => setTransportMode(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field('name', 'Name (optional)', { placeholder: 'e.g. Cult Wines air freight 9' })}
            <div>
              <label htmlFor="partner" className={label}>
                Partner
              </label>
              <select id="partner" value={form.partnerId} onChange={(e) => set('partnerId', e.target.value)} className={input}>
                <option value="">None</option>
                {partners?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.businessName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className={section}>
          <p className={heading}>Route and dates</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {field('originCity', 'Origin city')}
            {field('originCountry', 'Origin country')}
            {field('destinationCity', 'Destination city')}
            {field('destinationCountry', 'Destination country')}
            {type === 'inbound' ? field('destinationWarehouse', 'Destination warehouse', { span: true }) : null}
            {field('etd', 'ETD', { type: 'date' })}
            {field('eta', 'ETA', { type: 'date' })}
          </div>
        </section>

        <section className={section}>
          <p className={heading}>Carrier</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {field('carrierName', type === 'mainland_transfer' ? 'Transporter' : 'Carrier', { placeholder: 'e.g. Hillebrand, DHL' })}
            {field('carrierBookingRef', 'Booking reference')}
            {transportMode === 'air' ? field('awbNumber', 'AWB number', { span: true }) : null}
            {transportMode === 'sea_fcl' || transportMode === 'sea_lcl' ? (
              <>
                {field('containerNumber', 'Container number')}
                {field('blNumber', 'BL number')}
              </>
            ) : null}
          </div>
          <div>
            <label htmlFor="internalNotes" className={label}>
              Notes
            </label>
            <textarea
              id="internalNotes"
              rows={3}
              value={form.internalNotes}
              onChange={(e) => set('internalNotes', e.target.value)}
              className={`${input} h-auto py-2`}
            />
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Link
            href="/platform/admin/logistics/shipments"
            className="inline-flex h-10 items-center rounded-lg border border-border-muted px-4 text-sm font-medium text-text-primary hover:bg-surface-secondary"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-10 items-center rounded-lg bg-text-primary px-4 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? 'Creating…' : 'Create shipment'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewShipmentPage;
