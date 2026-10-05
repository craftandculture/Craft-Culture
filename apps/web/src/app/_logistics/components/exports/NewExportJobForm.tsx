'use client';

import { IconChevronRight, IconInfoCircle } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import ClientPicker, { type ClientValue } from './ClientPicker';
import ExportInvoiceSelect from './ExportInvoiceSelect';
import { card, input, label, money, pill, primaryButton, secondaryButton, sectionHeading } from './exportUi';
import { EXPORT_MODES, type ExportMode } from '../../utils/exportStages';

const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP'];

/**
 * Open an export job
 *
 * Client, origin, destination and mode are required; everything else can be
 * filled in as the job moves. Most jobs are land jobs, which need little more
 * than the invoice. Choosing Bonded transfer shows the bond, set at half the
 * goods value.
 */
const NewExportJobForm = () => {
  const api = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [client, setClient] = useState<ClientValue>({ clientName: '', zohoCustomerId: null });
  const [originCity, setOriginCity] = useState('Ras Al Khaimah');
  const [originCountry, setOriginCountry] = useState('UAE');
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [mode, setMode] = useState<ExportMode>('land');
  const [carrierName, setCarrierName] = useState('');
  const [exportInvoiceId, setExportInvoiceId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceValue, setInvoiceValue] = useState('');
  const [invoiceCurrency, setInvoiceCurrency] = useState('AED');
  const [notes, setNotes] = useState('');

  const create = useMutation({
    ...api.logistics.admin.exports.create.mutationOptions(),
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: api.logistics.admin.exports.getMany.queryKey() });
      toast.success(`${job.jobNumber} opened`);
      router.push(`/platform/admin/logistics/exports/${job.shipmentId}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const value = invoiceValue.trim() === '' ? null : Number(invoiceValue);
  const missing = [
    !client.clientName.trim() && 'client',
    !originCity.trim() && 'origin',
    !destinationCity.trim() && 'destination',
  ].filter(Boolean);

  const submit = () => {
    if (missing.length) {
      toast.error(`Enter the ${missing.join(', ')}`);
      return;
    }
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      toast.error('Enter the invoice value as a number');
      return;
    }
    create.mutate({
      clientName: client.clientName.trim(),
      zohoCustomerId: client.zohoCustomerId,
      originCity: originCity.trim(),
      originCountry: originCountry.trim() || null,
      destinationCity: destinationCity.trim(),
      destinationCountry: destinationCountry.trim() || null,
      mode,
      carrierName: carrierName.trim() || null,
      exportInvoiceId,
      invoiceNumber: invoiceNumber.trim() || null,
      invoiceValue: value,
      invoiceCurrency,
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-sm text-text-muted">
          <Link href="/platform/admin/logistics/exports" className="transition-colors hover:text-text-primary">
            Exports
          </Link>
          <IconChevronRight className="size-4" />
          <span className="text-text-primary">New job</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">New export job</h1>
        <p className="mt-0.5 text-sm text-text-muted">It is numbered EXP-CNC when you save it</p>
      </div>

      <section className={`${card} space-y-4 p-5`}>
        <p className={sectionHeading}>The job</p>

        <div>
          <label htmlFor="client" className={label}>
            Client *
          </label>
          <ClientPicker id="client" value={client} onChange={setClient} />
        </div>

        <div>
          <span className={label}>Mode *</span>
          <div className="flex flex-wrap gap-2">
            {EXPORT_MODES.map((m) => (
              <button key={m.key} type="button" className={pill(mode === m.key)} onClick={() => setMode(m.key)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="origin" className={label}>
              Origin *
            </label>
            <input id="origin" value={originCity} onChange={(e) => setOriginCity(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="origin-country" className={label}>
              Origin country
            </label>
            <input id="origin-country" value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="destination" className={label}>
              Destination *
            </label>
            <input
              id="destination"
              value={destinationCity}
              onChange={(e) => setDestinationCity(e.target.value)}
              placeholder={mode === 'bonded' ? 'e.g. Dubai bonded warehouse' : 'City or warehouse'}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="destination-country" className={label}>
              Destination country
            </label>
            <input
              id="destination-country"
              value={destinationCountry}
              onChange={(e) => setDestinationCountry(e.target.value)}
              className={input}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="carrier" className={label}>
              Carrier or transporter
            </label>
            <input id="carrier" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} className={input} />
          </div>
        </div>
      </section>

      <section className={`${card} space-y-4 p-5`}>
        <p className={sectionHeading}>Invoice</p>
        <div>
          <label htmlFor="export-invoice" className={label}>
            Link an export invoice (optional)
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
              if (!client.clientName.trim()) setClient({ clientName: invoice.consigneeName, zohoCustomerId: null });
            }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_7rem]">
          <div>
            <label htmlFor="invoice-number" className={label}>
              Invoice number
            </label>
            <input id="invoice-number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="invoice-value" className={label}>
              {mode === 'bonded' ? 'Goods value' : 'Final invoice value'}
            </label>
            <input
              id="invoice-value"
              inputMode="decimal"
              value={invoiceValue}
              onChange={(e) => setInvoiceValue(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="currency" className={label}>
              Currency
            </label>
            <select id="currency" value={invoiceCurrency} onChange={(e) => setInvoiceCurrency(e.target.value)} className={input}>
              {[...new Set([invoiceCurrency, ...CURRENCIES])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-text-muted">You can upload the invoice itself on the job once it is open.</p>

        {mode === 'bonded' ? (
          <div className="flex gap-2 rounded-lg bg-violet-50 p-3 text-sm text-violet-800 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-900">
            <IconInfoCircle size={18} className="mt-0.5 shrink-0" />
            <span>
              Bonded transfer: C&C puts down a movement bond of half the goods value
              {value ? ` (${money(value / 2, invoiceCurrency)})` : ''}. Record when it is paid on the job; the
              three-month claim window runs from that date.
            </span>
          </div>
        ) : null}
      </section>

      <section className={`${card} space-y-2 p-5`}>
        <label htmlFor="notes" className={sectionHeading}>
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={`${input} h-auto py-2`}
        />
      </section>

      <div className="flex justify-end gap-2">
        <Link href="/platform/admin/logistics/exports" className={secondaryButton}>
          Cancel
        </Link>
        <button type="button" onClick={submit} disabled={create.isPending} className={primaryButton}>
          {create.isPending ? 'Opening…' : 'Open job'}
        </button>
      </div>
    </div>
  );
};

export default NewExportJobForm;
