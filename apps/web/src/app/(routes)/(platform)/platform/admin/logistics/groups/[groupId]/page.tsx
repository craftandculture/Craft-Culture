'use client';

import {
  IconArrowLeft,
  IconCalculator,
  IconLoader2,
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

const COST_FIELDS = [
  { key: 'freightCostUsd', label: 'Freight' },
  { key: 'insuranceCostUsd', label: 'Insurance' },
  { key: 'originHandlingUsd', label: 'Origin handling' },
  { key: 'destinationHandlingUsd', label: 'Destination handling' },
  { key: 'customsClearanceUsd', label: 'Customs clearance' },
  { key: 'govFeesUsd', label: 'Gov fees' },
  { key: 'deliveryCostUsd', label: 'Delivery' },
  { key: 'otherCostsUsd', label: 'Other' },
] as const;

type CostKey = (typeof COST_FIELDS)[number]['key'];

const fmtUsd = (v: number | null | undefined) =>
  v == null ? '—' : `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const bottlesOf = (i: { totalBottles: number | null; cases: number; bottlesPerCase: number | null }) =>
  i.totalBottles ?? i.cases * (i.bottlesPerCase ?? 12);

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

  const [costs, setCosts] = useState<Record<CostKey, string>>({
    freightCostUsd: '',
    insuranceCostUsd: '',
    originHandlingUsd: '',
    destinationHandlingUsd: '',
    customsClearanceUsd: '',
    govFeesUsd: '',
    deliveryCostUsd: '',
    otherCostsUsd: '',
  });
  const [method, setMethod] = useState<'by_bottle' | 'by_weight' | 'by_value'>('by_bottle');

  // Hydrate cost inputs when the group loads
  useEffect(() => {
    if (!data?.group) return;
    const g = data.group;
    setCosts({
      freightCostUsd: g.freightCostUsd?.toString() ?? '',
      insuranceCostUsd: g.insuranceCostUsd?.toString() ?? '',
      originHandlingUsd: g.originHandlingUsd?.toString() ?? '',
      destinationHandlingUsd: g.destinationHandlingUsd?.toString() ?? '',
      customsClearanceUsd: g.customsClearanceUsd?.toString() ?? '',
      govFeesUsd: g.govFeesUsd?.toString() ?? '',
      deliveryCostUsd: g.deliveryCostUsd?.toString() ?? '',
      otherCostsUsd: g.otherCostsUsd?.toString() ?? '',
    });
    setMethod(g.costAllocationMethod ?? 'by_bottle');
  }, [data?.group]);

  const memberIds = useMemo(() => new Set(data?.shipments.map((s) => s.id) ?? []), [data]);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: api.logistics.admin.groups.getOne.queryKey() }),
      queryClient.invalidateQueries({ queryKey: api.logistics.admin.groups.getMany.queryKey() }),
    ]);

  const updateMut = useMutation({
    ...api.logistics.admin.groups.update.mutationOptions(),
    onSuccess: () => {
      void invalidate();
      toast.success('Saved');
    },
    onError: () => toast.error('Save failed'),
  });

  const calcMut = useMutation({
    ...api.logistics.admin.groups.calculate.mutationOptions(),
    onSuccess: (r) => {
      void invalidate();
      toast.success(
        `Allocated ${fmtUsd(r.totalLandedCost)} across ${r.totalBottles.toLocaleString()} bottles`,
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
      toast.success('Group deleted');
      router.push('/platform/admin/logistics/groups');
    },
  });

  const saveCosts = () => {
    const toNum = (v: string) => (v.trim() === '' ? null : Number(v));
    updateMut.mutate({
      id: groupId,
      costAllocationMethod: method,
      freightCostUsd: toNum(costs.freightCostUsd),
      insuranceCostUsd: toNum(costs.insuranceCostUsd),
      originHandlingUsd: toNum(costs.originHandlingUsd),
      destinationHandlingUsd: toNum(costs.destinationHandlingUsd),
      customsClearanceUsd: toNum(costs.customsClearanceUsd),
      govFeesUsd: toNum(costs.govFeesUsd),
      deliveryCostUsd: toNum(costs.deliveryCostUsd),
      otherCostsUsd: toNum(costs.otherCostsUsd),
    });
  };

  const toggleShipment = (shipmentId: string) => {
    const next = new Set(memberIds);
    if (next.has(shipmentId)) next.delete(shipmentId);
    else next.add(shipmentId);
    updateMut.mutate({ id: groupId, shipmentIds: Array.from(next) });
  };

  const totalCost = COST_FIELDS.reduce((s, f) => s + (Number(costs[f.key]) || 0), 0);

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <IconLoader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  const { group, shipments, totalBottles } = data;

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
                {shipments.length} shipments · {totalBottles.toLocaleString()} bottles
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
                  const landed = s.items.reduce((sum, i) => sum + (i.landedCostTotal ?? 0), 0);
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <Typography variant="labelSm" className="truncate">
                          {s.shipmentNumber} {s.name ? `· ${s.name}` : ''}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {s.items.length} lines · {bottles.toLocaleString()} bottles
                          {freight > 0
                            ? ` · freight ${fmtUsd(freight)} · landed ${fmtUsd(landed)}`
                            : ''}
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
            <div className="max-h-64 divide-y divide-border-muted overflow-y-auto">
              {(inboundData?.data ?? [])
                .filter((s) => !memberIds.has(s.id))
                .map((s) => {
                  const otherGroup = s.groupId && s.groupId !== groupId;
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-3 py-2 hover:bg-fill-primary-hover"
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggleShipment(s.id)}
                        className="h-4 w-4"
                      />
                      <div className="min-w-0 flex-1">
                        <Typography variant="bodySm" className="truncate">
                          {s.shipmentNumber} {s.name ? `· ${s.name}` : ''}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {s.totalCases} cases · {s.totalBottles} bottles
                          {otherGroup ? ' · in another group' : ''}
                        </Typography>
                      </div>
                    </label>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        {/* Costs */}
        <Card>
          <CardContent className="gap-3 p-4">
            <div className="flex items-center justify-between">
              <Typography variant="labelSm">Freight &amp; logistics costs (USD)</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Total {fmtUsd(totalCost)}
              </Typography>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {COST_FIELDS.map((f) => (
                <div key={f.key}>
                  <Typography variant="bodyXs" colorRole="muted">
                    {f.label}
                  </Typography>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={costs[f.key]}
                    onChange={(e) => setCosts((c) => ({ ...c, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Typography variant="bodyXs" colorRole="muted">
                  Allocation basis
                </Typography>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as typeof method)}
                  className="rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm text-text-primary focus:border-border-brand focus:outline-none"
                >
                  <option value="by_bottle">By bottle count</option>
                  <option value="by_weight">By weight</option>
                  <option value="by_value">By declared value</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={saveCosts} disabled={updateMut.isPending}>
                  <ButtonContent iconLeft={updateMut.isPending ? IconLoader2 : undefined}>
                    Save costs
                  </ButtonContent>
                </Button>
                <Button
                  onClick={() => calcMut.mutate({ id: groupId })}
                  disabled={calcMut.isPending || shipments.length === 0}
                >
                  <ButtonContent iconLeft={calcMut.isPending ? IconLoader2 : IconCalculator}>
                    Calculate &amp; apply
                  </ButtonContent>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live summary — goods off the items, freight off the cost inputs.
            Always current (updates as you edit items or type costs); no need to
            re-allocate just to see the numbers. */}
        {(() => {
          const goods = data.totalProductCost;
          const freightTotal = totalCost;
          const landed = goods + freightTotal;
          const bottles = totalBottles;
          const tiles = [
            { v: fmtUsd(goods), label: 'Goods (product) cost' },
            { v: fmtUsd(freightTotal), label: 'Freight & logistics' },
            { v: fmtUsd(landed), label: 'Total landed cost' },
            { v: bottles ? fmtUsd(landed / bottles) : '—', label: 'Landed / bottle' },
            { v: bottles ? fmtUsd(freightTotal / bottles) : '—', label: 'Freight / bottle' },
          ];
          return (
            <Card>
              <CardContent className="gap-2 p-4">
                <div className="flex flex-row flex-wrap items-center justify-around gap-4 text-center">
                  {tiles.map((t) => (
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
                    ? 'Applied to items — these costs are written onto each bottle for pricing.'
                    : 'Live preview. Hit “Calculate & apply” to write the freight onto each bottle.'}
                </Typography>
              </CardContent>
            </Card>
          );
        })()}
      </div>
    </main>
  );
};

export default ShipmentGroupDetailPage;
