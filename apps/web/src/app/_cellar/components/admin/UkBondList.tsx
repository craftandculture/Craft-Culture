'use client';

import { IconAlertTriangle, IconBottle, IconBuildingWarehouse, IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import useTRPC from '@/lib/trpc/browser';

type Filter = 'unassigned' | 'members' | 'house' | 'all';

/**
 * C&C's LCB Burton account: import LCB's report, then say whose each rotation is
 *
 * Exception-first. LCB's Rotation Stock report has no client column, so every
 * new rotation arrives unassigned and is the only thing on this screen that
 * needs a person. Once placed with a member it shows in their cellar, and
 * stays placed through every later import.
 */
const UkBondList = () => {
  const api = useTRPC();
  const fileInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<Filter | null>(null);

  const query = useQuery(api.cellar.admin.getUkStock.queryOptions());
  const { data, refetch } = query;

  const importStock = useMutation(
    api.cellar.admin.importUkStock.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `Imported ${result.lines} lines (${result.bottles} bottles) across ${result.rotations} rotations${
            result.autoAssigned ? ` — ${result.autoAssigned} placed by member reference` : ''
          }${result.unassigned ? ` — ${result.unassigned} to assign` : ''}`,
        );
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const [deliveryOwner, setDeliveryOwner] = useState<Record<string, string>>({});
  const assignMany = useMutation(
    api.cellar.admin.assignUkRotations.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.assigned} rotations assigned`);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const assign = useMutation(
    api.cellar.admin.assignUkRotation.mutationOptions({
      onSuccess: () => void refetch(),
      onError: (error) => toast.error(error.message),
    }),
  );

  const readFile = async (file: File) => {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];

      if (!sheet) throw new Error('The file has no sheets');

      const rows = XLSX.utils.sheet_to_json<Record<string, string | number | null>>(sheet, {
        defval: null,
        raw: false,
      });

      importStock.mutate({ rows });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read that file');
    }
  };

  const rotations = useMemo(() => {
    const byRotation = new Map<string, NonNullable<typeof data>['rows']>();

    for (const row of data?.rows ?? []) {
      byRotation.set(row.rotation, [...(byRotation.get(row.rotation) ?? []), row]);
    }

    return [...byRotation.entries()].map(([rotation, lines]) => {
      const first = lines[0]!;
      const state = first.isHouse ? 'house' : first.partnerId ? 'members' : 'unassigned';

      return {
        rotation,
        lines,
        state: state as Exclude<Filter, 'all'>,
        partnerId: first.partnerId,
        receivedAt: first.receivedAt,
        bottles: lines.reduce((sum, line) => sum + line.totalBottles, 0),
      };
    });
  }, [data]);

  const counts = {
    unassigned: rotations.filter((item) => item.state === 'unassigned').length,
    members: rotations.filter((item) => item.state === 'members').length,
    house: rotations.filter((item) => item.state === 'house').length,
    all: rotations.length,
  };

  const active: Filter = filter ?? (counts.unassigned > 0 ? 'unassigned' : 'all');
  const shown = rotations.filter((item) => active === 'all' || item.state === active);

  /*
    Unassigned rotations by the day LCB received them. LCB books every case as
    its own rotation, so one member's delivery is many rotations on one day;
    Jon De Jager's 19 October delivery was 193. A delivery is assigned as one.
  */
  const deliveries = useMemo(() => {
    const byDay = new Map<string, { key: string; label: string; rotations: string[]; bottles: number }>();
    for (const item of rotations) {
      if (item.state !== 'unassigned') continue;
      const key = item.receivedAt ? format(new Date(item.receivedAt), 'yyyy-MM-dd') : 'unknown';
      const entry = byDay.get(key) ?? {
        key,
        label: item.receivedAt ? format(new Date(item.receivedAt), 'd MMM yyyy') : 'No received date',
        rotations: [],
        bottles: 0,
      };
      entry.rotations.push(item.rotation);
      entry.bottles += item.bottles;
      byDay.set(key, entry);
    }
    return [...byDay.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [rotations]);
  const bottles = rotations.reduce((sum, item) => sum + item.bottles, 0);

  const tiles = [
    {
      label: 'Bottles at Burton',
      value: bottles.toLocaleString(),
      sub: `${data?.rows.length ?? 0} lines`,
      icon: IconBottle,
      tone: 'border-slate-200 from-slate-50/60 dark:border-slate-700 dark:from-slate-500/10',
      iconTone: 'bg-slate-100 text-slate-500 dark:bg-slate-500/20',
    },
    {
      label: 'For members',
      value: counts.members,
      sub: `${data?.ownerIds.length ?? 0} members`,
      icon: IconBuildingWarehouse,
      tone: 'border-emerald-100 from-emerald-50/50 dark:border-emerald-900/50 dark:from-emerald-500/10',
      iconTone: 'bg-emerald-100/70 text-emerald-600 dark:bg-emerald-500/20',
    },
    {
      label: 'To assign',
      value: counts.unassigned,
      sub: 'Not visible to anyone',
      icon: IconAlertTriangle,
      tone:
        counts.unassigned > 0
          ? 'border-red-100 from-red-50/50 dark:border-red-900/50 dark:from-red-500/10'
          : 'border-slate-200 from-slate-50/60 dark:border-slate-700 dark:from-slate-500/10',
      iconTone:
        counts.unassigned > 0
          ? 'bg-red-100/70 text-red-500 dark:bg-red-500/20'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-500/20',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-text-primary text-sm font-semibold">London City Bond, Burton · account CRACBG</p>
          <p className="text-text-muted text-xs">
            {data?.importedAt
              ? `LCB report imported ${format(new Date(data.importedAt), 'd MMM yyyy, HH:mm')}`
              : 'No LCB report imported yet'}
            . Export Rotation Stock from Vision and upload it here; each upload replaces the last.
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={importStock.isPending}
          className="bg-text-primary text-surface-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:opacity-50"
        >
          <IconUpload size={15} />
          {importStock.isPending ? 'Importing…' : 'Upload LCB report'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`rounded-xl border bg-gradient-to-b to-transparent px-3 py-2.5 text-center shadow-sm ${tile.tone}`}
          >
            <span className={`mx-auto mb-1 flex size-6 items-center justify-center rounded-md ${tile.iconTone}`}>
              <tile.icon size={13} />
            </span>
            <span className="text-text-primary block text-lg font-bold leading-tight tabular-nums">{tile.value}</span>
            <span className="text-text-muted block text-[11px]">{tile.label}</span>
            <span className="text-text-muted/80 block text-[10px]">{tile.sub}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['unassigned', 'To assign'],
            ['members', 'Members'],
            ['house', 'C&C stock'],
            ['all', 'All'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              active === key ? 'bg-text-primary text-surface-primary' : 'bg-surface-muted text-text-muted hover:text-text-primary'
            }`}
          >
            {label} <span className="tabular-nums opacity-70">{counts[key]}</span>
          </button>
        ))}
      </div>

      {active === 'unassigned' && deliveries.length > 0 && (
        <div className="border-border-muted bg-surface-primary divide-border-muted divide-y rounded-xl border shadow-sm">
          <p className="text-text-muted px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider">
            Assign a whole delivery
          </p>
          {deliveries.map((delivery) => (
            <div key={delivery.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <p className="text-text-primary text-sm">
                Received <span className="font-semibold">{delivery.label}</span>
                <span className="text-text-muted">
                  {' '}
                  · {delivery.rotations.length} {delivery.rotations.length === 1 ? 'rotation' : 'rotations'} ·{' '}
                  {delivery.bottles} {delivery.bottles === 1 ? 'bottle' : 'bottles'}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={deliveryOwner[delivery.key] ?? ''}
                  onChange={(event) =>
                    setDeliveryOwner((current) => ({ ...current, [delivery.key]: event.target.value }))
                  }
                  aria-label={`Whose wine is the delivery received ${delivery.label}`}
                  className="border-border-muted bg-surface-primary h-8 max-w-[240px] rounded-lg border px-2 text-xs font-semibold"
                >
                  <option value="">Whose wine is it…</option>
                  <option value="house">C&amp;C stock (not shown to members)</option>
                  {(data?.owners ?? []).map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.code ? `${owner.name} · ${owner.code}` : owner.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!deliveryOwner[delivery.key] || assignMany.isPending}
                  onClick={() => {
                    const value = deliveryOwner[delivery.key];
                    if (!value) return;
                    assignMany.mutate({
                      rotations: delivery.rotations,
                      owner: value === 'house' ? { kind: 'house' } : { kind: 'member', partnerId: value },
                    });
                  }}
                  className="bg-text-primary text-surface-primary h-8 rounded-lg px-3 text-xs font-semibold disabled:opacity-40"
                >
                  {assignMany.isPending ? 'Assigning…' : `Assign all ${delivery.rotations.length}`}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="border-border-muted text-text-muted rounded-xl border px-4 py-8 text-center text-sm">
          {rotations.length === 0 ? 'Upload LCB’s Rotation Stock report to begin.' : 'Nothing here.'}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((item) => (
            <li key={item.rotation} className="border-border-muted bg-surface-primary overflow-hidden rounded-xl border shadow-sm">
              <div className="border-border-muted flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                <p className="text-text-muted text-xs">
                  <span className="text-text-primary font-mono font-semibold">{item.rotation}</span>
                  {item.receivedAt ? ` · received ${format(new Date(item.receivedAt), 'd MMM yyyy')}` : ''} ·{' '}
                  {item.bottles} {item.bottles === 1 ? 'bottle' : 'bottles'}
                </p>
                <select
                  value={item.state === 'house' ? 'house' : (item.partnerId ?? '')}
                  disabled={assign.isPending}
                  onChange={(event) => {
                    const value = event.target.value;
                    assign.mutate({
                      rotation: item.rotation,
                      owner:
                        value === 'house'
                          ? { kind: 'house' }
                          : value
                            ? { kind: 'member', partnerId: value }
                            : { kind: 'none' },
                    });
                  }}
                  className={`border-border-muted h-8 max-w-[260px] rounded-lg border px-2 text-xs font-semibold ${
                    item.state === 'unassigned' ? 'text-red-600' : 'text-text-primary'
                  } bg-surface-primary`}
                >
                  <option value="">Choose whose wine this is…</option>
                  <option value="house">C&amp;C stock (not shown to members)</option>
                  {(data?.owners ?? []).map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.code ? `${owner.name} · ${owner.code}` : owner.name}
                    </option>
                  ))}
                </select>
              </div>
              <ul className="divide-border-muted divide-y">
                {item.lines.map((line) => (
                  <li key={line.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2 text-sm">
                    <span className="min-w-0">
                      {line.name}
                      <span className="text-text-muted"> · {line.vintage ?? 'NV'}</span>
                      <span className="text-text-muted/70 ml-2 font-mono text-[11px]">{line.lwin18}</span>
                    </span>
                    <span className="text-text-muted text-xs tabular-nums">
                      {line.cases > 0 ? `${line.cases} × ${line.bottlesPerCase ?? '?'}` : ''}
                      {line.cases > 0 && line.singles > 0 ? ' + ' : ''}
                      {line.singles > 0 ? `${line.singles} single${line.singles === 1 ? '' : 's'}` : ''}
                      {line.bottleSizeLitres && line.bottleSizeLitres !== 0.75 ? ` · ${line.bottleSizeLitres * 100}cl` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UkBondList;
