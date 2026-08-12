'use client';

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconReplace,
  IconSearch,
  IconTag,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import PickOrderLines from '@/app/_wms/components/PickOrderLines';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

/** Readiness filters — how pickable an order is right now. */
type ReadinessFilter = 'all' | 'ready' | 'repack' | 'unmatched';

const READINESS_FILTERS: { key: ReadinessFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'repack', label: 'Needs repack' },
  { key: 'unmatched', label: 'No stock' },
];

/**
 * Create new pick list from Zoho sales orders.
 *
 * Lists invoiced Zoho orders ready for picking. Cards lead with the invoice
 * number, customer, subject and value, and carry badges when lines need a
 * repack or have no matching stock. Expanding a card (several can be open at
 * once) shows each line's exact physical pick — the pack config, total bottles,
 * the bay it will be picked from, and whether a case must be broken.
 */
const NewPickListPage = () => {
  const router = useRouter();
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetch invoiced Zoho sales orders ready for picking
  const { data: zohoOrders, isLoading } = useQuery({
    ...api.zohoSalesOrders.list.queryOptions(),
    select: (orders) =>
      orders
        .filter((o) => o.status === 'synced' && o.zohoStatus === 'invoiced')
        .sort((a, b) =>
          (b.salesOrderNumber ?? '').localeCompare(a.salesOrderNumber ?? ''),
        ),
  });

  const releaseToPickMutation = useMutation({
    ...api.zohoSalesOrders.releaseToPick.mutationOptions(),
  });

  const syncMutation = useMutation({
    ...api.zohoSalesOrders.sync.mutationOptions(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries();
      toast.success(data.message);
    },
  });

  const toggleOrder = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const toggleExpand = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (selectedOrderIds.size === 0) return;
    setIsCreating(true);
    setCreateError(null);

    let succeeded = 0;
    let failed = 0;

    // Process sequentially to avoid pick list number race condition
    for (const id of Array.from(selectedOrderIds)) {
      try {
        await releaseToPickMutation.mutateAsync({ salesOrderId: id });
        succeeded++;
      } catch {
        failed++;
      }
    }

    setIsCreating(false);
    void queryClient.invalidateQueries();

    if (failed === 0) {
      toast.success(`${succeeded} pick list${succeeded === 1 ? '' : 's'} created`);
      router.push('/platform/admin/wms/pick');
    } else if (succeeded > 0) {
      toast.warning(`${succeeded} created, ${failed} failed`);
      router.push('/platform/admin/wms/pick');
    } else {
      setCreateError('Failed to create pick lists');
    }
  };

  // Filter by SO number, invoice number, customer or subject/reference, then by
  // how pickable the order is (repack needed / stock missing).
  const filteredOrders = zohoOrders?.filter((order) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      order.salesOrderNumber?.toLowerCase().includes(q) ||
      order.invoiceNumber?.toLowerCase().includes(q) ||
      order.customerName?.toLowerCase().includes(q) ||
      order.referenceNumber?.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    const repackLines = order.repackLines ?? 0;
    const unmatchedLines = order.unmatchedLines ?? 0;
    if (readinessFilter === 'repack') return repackLines > 0;
    if (readinessFilter === 'unmatched') return unmatchedLines > 0;
    if (readinessFilter === 'ready')
      return repackLines === 0 && unmatchedLines === 0;
    return true;
  });

  // Totals for the summary bar and the release button. Once anything is ticked
  // the numbers follow the SELECTION — a bar that keeps reporting the whole
  // list is worse than no bar when you're releasing one order of four.
  const totals = useMemo(() => {
    const orders = filteredOrders ?? [];
    const selected = orders.filter((o) => selectedOrderIds.has(o.id));
    const scope = selected.length > 0 ? selected : orders;
    return {
      isSelection: selected.length > 0,
      orders: scope.length,
      listedOrders: orders.length,
      lines: scope.reduce((sum, o) => sum + (o.itemCount ?? 0), 0),
      cases: scope.reduce((sum, o) => sum + (o.totalQuantity ?? 0), 0),
      bottles: scope.reduce(
        (sum, o) => sum + (o.bottleCount ?? o.totalQuantity ?? 0),
        0,
      ),
      value: scope.reduce((sum, o) => sum + (o.total ?? 0), 0),
      currency: scope[0]?.currencyCode ?? 'USD',
    };
  }, [filteredOrders, selectedOrderIds]);

  const allSelected =
    filteredOrders &&
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => selectedOrderIds.has(o.id));

  const toggleSelectAll = () => {
    if (!filteredOrders) return;
    setSelectedOrderIds(
      allSelected ? new Set() : new Set(filteredOrders.map((o) => o.id)),
    );
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-3 pb-28 sm:px-6 sm:py-6 sm:pb-8">
      <div className="space-y-3">
        {/* Header row — back, title, sync */}
        <div className="flex items-center gap-2">
          <Link
            href="/platform/admin/wms/pick"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-secondary active:bg-fill-secondary"
          >
            <IconArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-tight">New Pick List</h1>
            {filteredOrders && (
              <p className="text-[12px] leading-tight text-text-muted">
                {filteredOrders.length} sales order
                {filteredOrders.length === 1 ? '' : 's'} ready to pick
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-secondary active:bg-fill-secondary disabled:opacity-50"
          >
            {syncMutation.isPending ? (
              <IconLoader2 className="h-5 w-5 animate-spin" />
            ) : (
              <IconRefresh className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice, order, customer or subject..."
            className="w-full rounded-lg border border-border-primary bg-fill-primary py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Icon
              icon={IconLoader2}
              className="animate-spin"
              colorRole="muted"
              size="lg"
            />
          </div>
        )}

        {/* Summary bar — follows the selection once anything is ticked */}
        {!isLoading && filteredOrders && filteredOrders.length > 0 && (
          <div
            className={`flex items-stretch rounded-lg border py-2 ${
              totals.isSelection
                ? 'border-emerald-200 bg-emerald-50/60'
                : 'border-border-muted bg-fill-secondary/40'
            }`}
          >
            <div className="flex-1 text-center">
              <p className="text-[15px] font-bold leading-none tabular-nums">
                {totals.orders}
                {totals.isSelection && (
                  <span className="text-[11px] font-medium text-text-muted">
                    {' '}
                    of {totals.listedOrders}
                  </span>
                )}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-text-muted">
                {totals.isSelection ? 'Selected' : 'Orders'}
              </p>
            </div>
            <div className="w-px bg-border-muted" />
            <div className="flex-1 text-center">
              <p className="text-[15px] font-bold leading-none tabular-nums">
                {totals.bottles}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-text-muted">
                Bottles
              </p>
            </div>
            <div className="w-px bg-border-muted" />
            <div className="flex-1 text-center">
              <p className="text-[15px] font-bold leading-none tabular-nums">
                {formatPrice(totals.value, totals.currency)}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-text-muted">
                Value
              </p>
            </div>
          </div>
        )}

        {/* Readiness filters */}
        {!isLoading && zohoOrders && zohoOrders.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {READINESS_FILTERS.map(({ key, label }) => {
              const count =
                key === 'all'
                  ? zohoOrders.length
                  : zohoOrders.filter((o) => {
                      const repackLines = o.repackLines ?? 0;
                      const unmatchedLines = o.unmatchedLines ?? 0;
                      if (key === 'repack') return repackLines > 0;
                      if (key === 'unmatched') return unmatchedLines > 0;
                      return repackLines === 0 && unmatchedLines === 0;
                    }).length;
              const isActive = readinessFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setReadinessFilter(key)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    isActive
                      ? 'bg-text-primary text-white'
                      : 'bg-fill-secondary text-text-muted hover:bg-fill-secondary/70'
                  }`}
                >
                  {label}
                  <span
                    className={`tabular-nums ${
                      isActive ? 'text-white/70' : 'text-text-muted/70'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Select All bar */}
        {!isLoading && filteredOrders && filteredOrders.length > 1 && (
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-text-muted transition-colors hover:bg-fill-secondary active:bg-fill-secondary"
          >
            <div
              className={`flex h-5 w-5 items-center justify-center rounded ${
                allSelected
                  ? 'bg-brand-500 text-white'
                  : 'border-2 border-text-muted/40'
              }`}
            >
              {allSelected && <IconCheck className="h-3.5 w-3.5" />}
            </div>
            {allSelected ? 'Deselect All' : `Select All (${filteredOrders.length})`}
          </button>
        )}

        {/* Sales Orders List */}
        {!isLoading && (
          <div>
            {filteredOrders?.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Typography variant="headingSm" className="mb-2">
                    No Sales Orders Available
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    There are no invoiced sales orders ready for picking
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border-primary">
                {filteredOrders?.map((order, index) => {
                  const isSelected = selectedOrderIds.has(order.id);
                  const isExpanded = expandedOrderIds.has(order.id);
                  const showBottleTotal =
                    order.bottleCount != null &&
                    order.bottleCount !== order.totalQuantity;
                  const repackLines = order.repackLines ?? 0;
                  const unmatchedLines = order.unmatchedLines ?? 0;
                  return (
                    <div
                      key={order.id}
                      className={`cursor-pointer transition-colors ${
                        index > 0 ? 'border-t border-border-muted' : ''
                      } ${
                        isSelected
                          ? 'bg-emerald-50 shadow-[inset_3px_0_0_#10b981]'
                          : 'bg-fill-primary hover:bg-surface-secondary/50'
                      }`}
                      onClick={() => toggleOrder(order.id)}
                    >
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        {/* Checkbox */}
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${
                            isSelected
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'border-2 border-text-muted/30'
                          }`}
                        >
                          {isSelected && <IconCheck className="h-4 w-4" />}
                        </div>

                        {/* Order info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-[15px] font-bold leading-tight">
                              {order.invoiceNumber ?? order.salesOrderNumber}
                            </span>
                            {order.invoiceNumber && (
                              <span className="text-[11px] text-text-muted">
                                {order.salesOrderNumber}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[13px] font-medium leading-tight text-text-primary">
                            {order.customerName ?? 'Unknown'}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {order.referenceNumber && (
                              <span className="inline-flex max-w-full items-center gap-1 truncate rounded bg-fill-secondary px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
                                <IconTag className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {order.referenceNumber}
                                </span>
                              </span>
                            )}
                            {unmatchedLines > 0 && (
                              <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700">
                                <IconAlertTriangle className="h-3 w-3 shrink-0" />
                                {unmatchedLines} no stock
                              </span>
                            )}
                            {repackLines > 0 && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">
                                <IconReplace className="h-3 w-3 shrink-0" />
                                {repackLines} repack
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quantity + value — bottles carry equal weight to
                            cases: a split or repack is counted in bottles. */}
                        <div className="shrink-0 text-right">
                          <span className="text-[17px] font-bold tabular-nums leading-tight">
                            {order.totalQuantity}
                          </span>
                          <p className="text-[11px] leading-tight text-text-muted">
                            {order.totalQuantity === 1 ? 'case' : 'cases'}
                          </p>
                          {showBottleTotal && (
                            <p className="text-[13px] font-semibold tabular-nums leading-tight text-text-primary">
                              {order.bottleCount} btl
                            </p>
                          )}
                          {order.total != null && (
                            <p className="mt-0.5 text-[12px] font-semibold tabular-nums leading-tight text-text-muted">
                              {formatPrice(order.total, order.currencyCode ?? 'USD')}
                            </p>
                          )}
                        </div>

                        {/* Expand chevron */}
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(e, order.id)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted/60 hover:bg-black/5 hover:text-text-muted"
                        >
                          <Icon
                            icon={isExpanded ? IconChevronUp : IconChevronDown}
                            size="sm"
                          />
                        </button>
                      </div>

                      {/* Expanded items — exact physical pick per line */}
                      {isExpanded && (
                        <div
                          className="border-t border-border-muted bg-fill-secondary/60 px-4 py-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PickOrderLines orderId={order.id} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky bottom action bar */}
      {selectedOrderIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-primary bg-fill-primary px-4 py-3 shadow-lg sm:static sm:mt-4 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[15px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60"
          >
            {isCreating ? (
              <IconLoader2 className="h-5 w-5 animate-spin" />
            ) : (
              <IconPlus className="h-5 w-5" />
            )}
            {isCreating
              ? 'Releasing...'
              : `Release ${selectedOrderIds.size} Order${selectedOrderIds.size === 1 ? '' : 's'} · ${totals.lines} line${totals.lines === 1 ? '' : 's'} · ${totals.cases} case${totals.cases === 1 ? '' : 's'} · ${totals.bottles} btl`}
          </button>
          {createError && (
            <p className="mt-2 text-center text-[13px] text-red-600">
              {createError}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default NewPickListPage;
