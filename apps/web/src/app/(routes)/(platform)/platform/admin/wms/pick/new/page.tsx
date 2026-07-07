'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconLoader2,
  IconPlus,
  IconRefresh,
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
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

/**
 * Create new pick list from Zoho sales orders.
 *
 * Lists invoiced Zoho orders ready for picking. Each card shows the invoice
 * number (primary), sales order number, customer, order subject/reference and
 * value so the picker has full context. Expanding a card shows each line's pack
 * config (e.g. 6×75cl) and flags single bottles so "x1" is never mistaken for a
 * full case.
 */
const NewPickListPage = () => {
  const router = useRouter();
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
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

  // Lazy-load line items when a card is expanded
  const { data: expandedOrder, isLoading: isLoadingItems } = useQuery({
    ...api.zohoSalesOrders.get.queryOptions({ id: expandedOrderId ?? '' }),
    enabled: !!expandedOrderId,
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
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
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

  // Filter by SO number, invoice number, customer or subject/reference
  const filteredOrders = zohoOrders?.filter((order) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      order.salesOrderNumber?.toLowerCase().includes(q) ||
      order.invoiceNumber?.toLowerCase().includes(q) ||
      order.customerName?.toLowerCase().includes(q) ||
      order.referenceNumber?.toLowerCase().includes(q)
    );
  });

  const selectedCaseCount = useMemo(() => {
    if (!filteredOrders) return 0;
    return filteredOrders
      .filter((o) => selectedOrderIds.has(o.id))
      .reduce((sum, o) => sum + (o.totalQuantity ?? 0), 0);
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
                  const isExpanded = expandedOrderId === order.id;
                  const unit = order.unitLabel ?? 'case';
                  return (
                    <div
                      key={order.id}
                      className={`cursor-pointer transition-colors ${
                        index > 0 ? 'border-t border-border-muted' : ''
                      } ${
                        isSelected
                          ? 'bg-emerald-50'
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
                          {order.referenceNumber && (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] leading-tight text-text-muted">
                              <IconTag className="h-3 w-3 shrink-0" />
                              {order.referenceNumber}
                            </p>
                          )}
                        </div>

                        {/* Cases + value — prominent */}
                        <div className="shrink-0 text-right">
                          <span className="text-[17px] font-bold tabular-nums leading-tight">
                            {order.totalQuantity}
                          </span>
                          <p className="text-[11px] leading-tight text-text-muted">
                            {unit}
                            {order.totalQuantity === 1 ? '' : 's'}
                          </p>
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

                      {/* Expanded items — with pack config / single-bottle flag */}
                      {isExpanded && (
                        <div className="border-t border-border-muted bg-fill-secondary/60 px-4 py-2">
                          {isLoadingItems ? (
                            <div className="flex items-center justify-center py-2">
                              <IconLoader2 className="h-4 w-4 animate-spin text-text-muted" />
                            </div>
                          ) : expandedOrder?.items.length ? (
                            <div className="space-y-1">
                              {expandedOrder.items.map((item) => {
                                const isSingle = /single bottle/i.test(
                                  item.name ?? '',
                                );
                                const cleanName = (item.name ?? '')
                                  .replace(/\s*\(single bottle\)\s*/i, '')
                                  .trim();
                                const config = item.description
                                  ?.replace(/x/gi, '×')
                                  .trim();
                                return (
                                  <div
                                    key={item.id}
                                    className="flex items-center gap-2 py-0.5 text-[13px]"
                                  >
                                    <span className="min-w-0 flex-1 truncate text-text-primary">
                                      {cleanName}
                                    </span>
                                    {isSingle ? (
                                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                        Single bottle
                                      </span>
                                    ) : (
                                      config && (
                                        <span className="shrink-0 rounded bg-fill-primary px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
                                          {config}
                                        </span>
                                      )
                                    )}
                                    <span className="shrink-0 font-semibold tabular-nums text-text-muted">
                                      ×{item.quantity}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="py-1 text-center text-[13px] text-text-muted">
                              No items
                            </p>
                          )}
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
              : `Release ${selectedOrderIds.size} Order${selectedOrderIds.size === 1 ? '' : 's'} (${selectedCaseCount} cases)`}
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
