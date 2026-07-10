'use client';

import {
  IconArrowLeft,
  IconCalculator,
  IconLoader2,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
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

const fmtUsd = (v: number | null | undefined) =>
  v == null ? '—' : `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const bottlesOf = (i: { totalBottles: number | null; cases: number; bottlesPerCase: number | null }) =>
  i.totalBottles ?? i.cases * (i.bottlesPerCase ?? 12);

const selectCls =
  'rounded-lg border border-border-primary bg-background-primary px-2.5 py-2 text-sm text-text-primary focus:border-border-brand focus:outline-none';

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

  const { group, shipments, totalBottles, totalCases, totalProductCost, costLines, metrics } = data;
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

        {/* Logistics cost ledger */}
        <Card>
          <CardContent className="gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Typography variant="labelSm">Logistics cost ledger</Typography>
              <div className="flex items-center gap-2">
                <Typography variant="bodyXs" colorRole="muted">
                  AWB weight (kg)
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
                  className={`${selectCls} w-24 text-right`}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Cost lines */}
            {costLines.length > 0 && (
              <div className="divide-y divide-border-muted">
                {costLines.map((l) => {
                  const shp = shipments.find((s) => s.id === l.shipmentId);
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-3 py-1.5">
                      <div className="min-w-0">
                        <Typography variant="bodySm" className="truncate">
                          <span className="capitalize">{l.category}</span>
                          {l.description ? ` · ${l.description}` : ''}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {l.currency} {l.amount.toLocaleString()}
                          {l.currency !== 'USD' ? ` @ ${l.fxToUsd}` : ''}
                          {l.scope === 'shipment'
                            ? ` · ${shp?.shipmentNumber ?? 'shipment'}`
                            : ' · shared'}
                          {l.invoiceRef ? ` · ${l.invoiceRef}` : ''}
                        </Typography>
                      </div>
                      <div className="flex items-center gap-2">
                        <Typography variant="labelSm">{fmtUsd(l.amountUsd)}</Typography>
                        <button
                          onClick={() => delLineMut.mutate({ id: l.id })}
                          className="text-text-muted hover:text-red-500"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between py-1.5">
                  <Typography variant="labelSm">Total logistics</Typography>
                  <Typography variant="labelSm">{fmtUsd(metrics.totalLogisticsUsd)}</Typography>
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
                { v: fmtUsd(metrics.perBottle), label: 'Logistics / bottle' },
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
