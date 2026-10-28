'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

export interface AddToStockPanelProps {
  /** Pre-filled from a Stock Explorer row ("Add more"); omitted for a new wine */
  template?: {
    lwin18: string;
    productName: string;
    caseConfig: number | null;
    ownerId?: string;
    locationCode?: string;
  };
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Add wine to stock that never came through receiving, from Stock Explorer
 *
 * For catching up: a line missed at receiving is booked straight to its owner
 * and bay, dated the day it actually arrived, with a reason. The owner's
 * timeline shows it arriving that day; no notice is sent.
 */
const AddToStockPanel = ({ template, onClose }: AddToStockPanelProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [wine, setWine] = useState<{ lwin18: string; productName: string } | null>(
    template ? { lwin18: template.lwin18, productName: template.productName } : null,
  );
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [manual, setManual] = useState(false);
  const [productName, setProductName] = useState('');
  const [producer, setProducer] = useState('');
  const [vintage, setVintage] = useState('');
  const [lwin, setLwin] = useState('');
  const [bottleSizeMl, setBottleSizeMl] = useState(750);
  const [ownerId, setOwnerId] = useState(template?.ownerId ?? '');
  const [locationId, setLocationId] = useState('');
  const [caseConfig, setCaseConfig] = useState(template?.caseConfig && template.caseConfig > 1 ? template.caseConfig : 6);
  const [cases, setCases] = useState(template?.caseConfig && template.caseConfig > 1 ? 1 : 0);
  const [looseBottles, setLooseBottles] = useState(template?.caseConfig === 1 ? 1 : 0);
  const [arrivedOn, setArrivedOn] = useState(today());
  const [lotNumber, setLotNumber] = useState('');
  const [reExportBoeNumber, setReExportBoeNumber] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: searchData } = useQuery({
    ...api.wms.admin.stock.search.queryOptions({ query: debounced, limit: 10 }),
    enabled: !wine && !manual && debounced.length >= 2,
  });
  const { data: owners } = useQuery({ ...api.partners.list.queryOptions() });
  const { data: bays } = useQuery({ ...api.wms.admin.locations.getMany.queryOptions({ isActive: true }) });

  // "Add more" starts at the row's own bay
  useEffect(() => {
    if (locationId || !template?.locationCode || !bays) return;
    const bay = bays.find((b) => b.locationCode === template.locationCode);
    if (bay) setLocationId(bay.id);
  }, [bays, locationId, template?.locationCode]);

  const addToStock = useMutation(
    api.wms.admin.stock.addToStock.mutationOptions({
      onSuccess: async (result) => {
        toast.success(`${result.bottles} bottle(s) of ${result.productName} added to ${result.owner}'s stock at ${result.bay}.`);
        await queryClient.invalidateQueries();
        onClose();
      },
      onError: (error) => {
        toast.error(error.message);
        setConfirming(false);
      },
    }),
  );

  const products = (searchData?.results ?? []).filter((r) => r.type === 'product');
  const ownerName = owners?.find((o) => o.id === ownerId)?.name;
  const bayCode = bays?.find((b) => b.id === locationId)?.locationCode;
  const name = wine?.productName ?? productName.trim();
  const bottles = cases * caseConfig + looseBottles;
  const day = new Date(`${arrivedOn}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const quantityText = [
    cases > 0 ? `${cases} ${cases === 1 ? 'case' : 'cases'} of ${caseConfig}` : null,
    looseBottles > 0 ? `${looseBottles} ${looseBottles === 1 ? 'bottle' : 'bottles'}` : null,
  ]
    .filter(Boolean)
    .join(' + ');

  const missing =
    (!name ? 'Choose a wine. ' : '') +
    (!ownerId ? 'Choose the owner. ' : '') +
    (!locationId ? 'Choose the bay. ' : '') +
    (bottles <= 0 ? 'Add at least one case or bottle. ' : '') +
    (!reason.trim() ? 'Say why it is being added.' : '');

  const submit = () =>
    addToStock.mutate({
      ownerId,
      locationId,
      templateLwin18: wine?.lwin18,
      productName: wine ? undefined : productName.trim(),
      producer: wine ? undefined : producer.trim() || undefined,
      vintage: wine ? undefined : vintage.trim() || undefined,
      lwin: wine ? undefined : lwin.trim() || undefined,
      bottleSizeMl,
      caseConfig,
      cases,
      looseBottles,
      arrivedOn,
      lotNumber: lotNumber.trim() || undefined,
      reExportBoeNumber: reExportBoeNumber.trim() || undefined,
      reason: reason.trim(),
    });

  const field = 'border-border-muted bg-background-primary rounded-md border px-2 py-1.5 text-sm';

  return (
    <div
      className="border-border-muted space-y-3 rounded-lg border bg-emerald-50/60 p-3 dark:bg-emerald-900/10"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Add to stock{wine ? ` · ${wine.productName}` : ''}</p>
        <button type="button" onClick={onClose} className="text-text-muted text-xs underline">
          Cancel
        </button>
      </div>

      {!wine && (
        <div className="space-y-2">
          {!manual ? (
            <>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Wine
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search stock by name, producer or LWIN"
                  className={field}
                />
              </label>
              {products.length > 0 && (
                <div className="border-border-muted divide-border-muted max-h-48 divide-y overflow-auto rounded-md border bg-background-primary">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setWine({ lwin18: p.id, productName: p.title });
                        const pack = Number(p.id.split('-')[2]) || 1;
                        setCaseConfig(pack > 1 ? pack : 6);
                        setCases(pack > 1 ? 1 : 0);
                        setLooseBottles(pack === 1 ? 1 : 0);
                      }}
                      className="hover:bg-surface-secondary/50 flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                    >
                      <span>
                        {p.title}
                        <span className="text-text-muted block text-xs">{p.subtitle}</span>
                      </span>
                      <span className="text-text-muted font-mono text-[11px]">{p.id}</span>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setManual(true)} className="text-text-muted text-xs underline">
                Not in stock records? Enter it by hand
              </button>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
                Wine name
                <input value={productName} onChange={(e) => setProductName(e.target.value)} className={field} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Producer
                <input value={producer} onChange={(e) => setProducer(e.target.value)} className={field} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Vintage
                <input value={vintage} onChange={(e) => setVintage(e.target.value)} placeholder="2021 or NV" className={field} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                LWIN (7 digits or LWIN18)
                <input value={lwin} onChange={(e) => setLwin(e.target.value)} className={field} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Bottle size
                <select value={bottleSizeMl} onChange={(e) => setBottleSizeMl(Number(e.target.value))} className={field}>
                  {[375, 500, 700, 750, 1000, 1500, 3000, 6000].map((ml) => (
                    <option key={ml} value={ml}>
                      {ml >= 1000 ? `${ml / 1000}L` : `${ml / 10}cl`}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => setManual(false)} className="text-text-muted self-end text-xs underline">
                Search stock instead
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Owner
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={field}>
            <option value="">Choose…</option>
            {(owners ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Bay
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={field}>
            <option value="">Choose…</option>
            {(bays ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.locationCode}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-xs font-medium">
          Sealed cases
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={cases}
              onChange={(e) => setCases(Math.max(0, parseInt(e.target.value) || 0))}
              className={`${field} w-20`}
              aria-label="Cases"
            />
            <span className="text-text-muted font-normal">of</span>
            <input
              type="number"
              min={2}
              value={caseConfig}
              onChange={(e) => setCaseConfig(Math.max(2, parseInt(e.target.value) || 2))}
              className={`${field} w-16`}
              aria-label="Bottles per case"
            />
          </div>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Loose bottles
          <input
            type="number"
            min={0}
            value={looseBottles}
            onChange={(e) => setLooseBottles(Math.max(0, parseInt(e.target.value) || 0))}
            className={`${field} w-24`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Arrived on
          <input
            type="date"
            value={arrivedOn}
            max={today()}
            onChange={(e) => setArrivedOn(e.target.value || today())}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Lot (optional)
          <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder="e.g. 2026-09-09-001" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Re-export BOE (optional)
          <input value={reExportBoeNumber} onChange={(e) => setReExportBoeNumber(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2 lg:col-span-4">
          Reason (required)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Missed at receiving on SHP-2026-0012"
            className={field}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        {!missing ? (
          <span>
            Adds {quantityText} of <strong>{name}</strong> to {ownerName}&apos;s stock at {bayCode}, arrived {day}. The
            owner&apos;s timeline shows it arriving that day; no notice is sent.
          </span>
        ) : (
          <span className="text-red-700">{missing}</span>
        )}
      </div>

      <div className="flex gap-2">
        {!confirming ? (
          <button
            type="button"
            disabled={Boolean(missing)}
            onClick={() => setConfirming(true)}
            className="bg-text-primary text-background-primary rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            Add to stock
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={addToStock.isPending}
              onClick={submit}
              className="bg-text-primary text-background-primary rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            >
              {addToStock.isPending ? 'Adding…' : `Confirm: add ${bottles} bottle(s)`}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-text-muted px-2 text-sm underline">
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AddToStockPanel;
