'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import useTRPC from '@/lib/trpc/browser';

import { UK_BONDS, UK_EORI, UK_IMPORT_REASON } from '../constants';
import type { UkBondKey } from '../constants';

/** Vercel refuses a request body over 4.5 MB; base64 adds a third */
const MAX_TOTAL_BYTES = 3_200_000;

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });

const field = 'w-full rounded-lg border border-border-primary bg-fill-primary px-3 py-2 text-sm';

/**
 * Start a UK import: the documents, the bond, the rate
 *
 * Shipper is always C&C's UK EORI and importer C&C FZE, so the operator only
 * says where the wine leaves from, how it travels and the GBP rate. The draft
 * opens in the export invoice editor, where each line is checked.
 */
const NewUkImportClient = () => {
  const api = useTRPC();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [bond, setBond] = useState<UkBondKey | 'other'>('lcbTilbury');
  const [otherName, setOtherName] = useState('');
  const [otherAddress, setOtherAddress] = useState('');
  const [rate, setRate] = useState('1.27');
  const [transport, setTransport] = useState<'Air Freight' | 'Sea Freight'>('Air Freight');
  const [portOfLoading, setPortOfLoading] = useState('London Heathrow (LHR), United Kingdom');
  const [portOfDischarge, setPortOfDischarge] = useState('RAK Airport (RKT)');
  const [reason, setReason] = useState(UK_IMPORT_REASON);

  const create = useMutation({
    ...api.exportInvoices.admin.createUkImportDraft.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`${result.lines} lines read. Check each one before issuing.`);
      router.push(`/platform/admin/logistics/export-invoices/${result.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const rateValue = Number(rate);
  const ready =
    files.length > 0 &&
    totalBytes <= MAX_TOTAL_BYTES &&
    rateValue > 0 &&
    (bond !== 'other' || (otherName.trim() && otherAddress.trim()));

  const setMode = (mode: 'Air Freight' | 'Sea Freight') => {
    setTransport(mode);
    setPortOfDischarge(mode === 'Air Freight' ? 'RAK Airport (RKT)' : 'Saqr Port, Ras Al Khaimah');
    setPortOfLoading(mode === 'Air Freight' ? 'London Heathrow (LHR), United Kingdom' : 'London Gateway, United Kingdom');
  };

  const submit = async () => {
    const payload = await Promise.all(
      files.map(async (f) => ({ name: f.name, mimeType: f.type || 'application/octet-stream', data: await readAsBase64(f) })),
    );
    create.mutate({
      files: payload,
      bond: bond === 'other' ? { name: otherName.trim(), address: otherAddress.trim() } : bond,
      gbpUsdRate: rateValue,
      transport,
      portOfLoading,
      portOfDischarge,
      reason,
    });
  };

  return (
    <div className="max-w-2xl space-y-6 pb-24">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">1 · Supplier documents</p>
        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-border-primary bg-fill-muted/20 px-4 py-8 text-center text-sm hover:bg-fill-muted/40">
          <span className="font-medium">Choose files</span>
          <span className="text-xs text-text-muted">PDF invoices, screenshots or an Excel/CSV list · up to 8 files</span>
          <input
            type="file"
            multiple
            accept="application/pdf,image/*,.xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles((current) => [...current, ...picked].slice(0, 8));
              e.target.value = '';
            }}
          />
        </label>
        {files.length > 0 && (
          <ul className="divide-y divide-border-muted rounded-xl border border-border-muted bg-fill-primary text-sm">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate">{f.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-text-muted">
                  {(f.size / 1024).toFixed(0)} KB
                  <button type="button" className="hover:text-text-danger" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {totalBytes > MAX_TOTAL_BYTES && (
          <p className="text-xs text-text-danger">The files come to more than 3 MB together. Upload fewer at once, or smaller scans.</p>
        )}
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">2 · Shipment</p>
        <label className="block space-y-1 text-sm">
          <span className="text-text-muted">Collected from</span>
          <select className={field} value={bond} onChange={(e) => setBond(e.target.value as UkBondKey | 'other')}>
            {(Object.keys(UK_BONDS) as UkBondKey[]).map((k) => (
              <option key={k} value={k}>{UK_BONDS[k].name}</option>
            ))}
            <option value="other">Another bond or merchant…</option>
          </select>
        </label>
        {bond === 'other' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={field} placeholder="Name, e.g. Octavian, Corsham" value={otherName} onChange={(e) => setOtherName(e.target.value)} />
            <input className={field} placeholder="Collection address" value={otherAddress} onChange={(e) => setOtherAddress(e.target.value)} />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="text-text-muted">Mode of transport</span>
            <select className={field} value={transport} onChange={(e) => setMode(e.target.value as 'Air Freight' | 'Sea Freight')}>
              <option>Air Freight</option>
              <option>Sea Freight</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-text-muted">GBP → USD rate</span>
            <input className={field} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-text-muted">Port of loading</span>
            <input className={field} value={portOfLoading} onChange={(e) => setPortOfLoading(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-text-muted">Port of discharge</span>
            <input className={field} value={portOfDischarge} onChange={(e) => setPortOfDischarge(e.target.value)} />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-text-muted">Reason for export</span>
          <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <p className="text-xs text-text-muted">
          Shipper: Craft and Culture, UK EORI {UK_EORI}. Importer: Craft and Culture FZE. The issued PDF carries the UK EORI stamp.
        </p>
      </section>

      <Button colorRole="brand" disabled={!ready || create.isPending} onClick={() => void submit()}>
        {create.isPending ? 'Reading the documents…' : 'Read documents and build draft'}
      </Button>
    </div>
  );
};

export default NewUkImportClient;
