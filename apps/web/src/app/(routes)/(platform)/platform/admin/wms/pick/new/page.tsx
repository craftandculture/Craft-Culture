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

type Tab = 'sales' | 'private';

/**
 * Create new pick list from order
 *
 * Shows two tabs: Sales Orders (Zoho) and Private Orders (PCO).
 * Sales Orders tab is the default — shows invoiced Zoho orders ready for picking.
 */
const NewPickListPage = () => {
  const router = useRouter();
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Fetch Zoho sales orders
  const { data: zohoOrders, isLoading: isLoadingZoho } = useQuery({
    ...api.zohoSalesOrders.list.queryOptions(),
    select: (orders) =>
      orders
        .filter(
          (o) => o.status === 'synced' && o.zohoStatus === 'invoiced',
        )
        .sort((a, b) =>
          (b.salesOrderNumber ?? '').localeCompare(
            a.salesOrderNumber ?? '',
          ),
        ),
  });

  // Fetch PCO orders (cc_approved status, no pick list yet)
  const { data: pcoOrders, isLoading: isLoadingPco } = useQuery({
    ...api.privateClientOrders.adminGetMany.queryOptions({
      status: 'cc_approved',
      limit: 50,
    }),
  });

  // Lazy-load Zoho order items when expanded
  const { data: expandedZohoOrder, isLoading: isLoadingZohoItems } = useQuery({
    ...api.zohoSalesOrders.get.queryOptions({
      id: expandedOrderId ?? '',
    }),
    enabled: !!expandedOrderId && activeTab === 'sales',
  });

  // Lazy-load PCO order items when expanded
  const { data: expandedPcoOrder, isLoading: isLoadingPcoItems } = useQuery({
    ...api.privateClientOrders.adminGetOne.queryOptions({
      id: expandedOrderId ?? '',
    }),
    enabled: !!expandedOrderId && activeTab === 'private',
  });

  // Release Zoho order to pick (creates pick list)
  const releaseToPickMutation = useMutation({
    ...api.zohoSalesOrders.releaseToPick.mutationOptions(),
  });

  // Create PCO pick list
  const createPcoMutation = useMutation({
    ...api.wms.admin.picking.create.mutationOptions(),
  });

  // Sync Zoho orders
  const syncMutation = useMutation({
    ...api.zohoSalesOrders.sync.mutationOptions(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries();
      toast.success(data.message);
    },
  });

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

    const ids = Array.from(selectedOrderIds);
    let succeeded = 0;
    let failed = 0;

    // Process sequentially to avoid pick list number race condition
    for (const id of ids) {
      try {
        if (activeTab === 'sales') {
          await releaseToPickMutation.mutateAsync({ salesOrderId: id });
        } else {
          await createPcoMutation.mutateAsync({ orderId: id });
        }
        succeeded++;
      } catch {
        failed++;
      }
    }

    setIsCreating(false);
    void queryClient.invalidateQueries();

    if (failed === 0) {
      toast.success(
        `${succeeded} pick list${succeeded === 1 ? '' : 's'} created`,
      );
      router.push('/platform/admin/wms/pick');
    } else if (succeeded > 0) {
      toast.warning(
        `${succeeded} created, ${failed} failed`,
      );
      router.push('/platform/admin/wms/pick');
    } else {
      const firstError = results.find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      setCreateError(
        firstError?.reason instanceof Error
          ? firstError.reason.message
          : 'Failed to create pick lists',
      );
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSelectedOrderIds(new Set());
    setSearchQuery('');
    setExpandedOrderId(null);
  };

  // Filter Zoho orders by search
  const filteredZohoOrders = zohoOrders?.filter((order) =>
    searchQuery
      ? order.salesOrderNumber
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        order.invoiceNumber
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        order.customerName
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase())
      : true,
  );

  // Filter PCO orders by search
  const filteredPcoOrders = pcoOrders?.data.filter((order) =>
    searchQuery
      ? order.orderNumber
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        order.clientName
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase())
      : true,
  );

  const isLoading = activeTab === 'sales' ? isLoadingZoho : isLoadingPco;

  // Compute total selected cases for the action bar
  const selectedCaseCount = useMemo(() => {
    if (activeTab === 'sales' && filteredZohoOrders) {
      return filteredZohoOrders
        .filter((o) => selectedOrderIds.has(o.id))
        .reduce((sum, o) => sum + (o.totalQuantity ?? 0), 0);
    }
    if (activeTab === 'private' && filteredPcoOrders) {
      return filteredPcoOrders
        .filter((o) => selectedOrderIds.has(o.id))
        .reduce((sum, o) => sum + (o.caseCount ?? 0), 0);
    }
    return 0;
  }, [activeTab, filteredZohoOrders, filteredPcoOrders, selectedOrderIds]);

  // Select All helpers
  const currentOrders = activeTab === 'sales' ? filteredZohoOrders : filteredPcoOrders;
  const allSelected = currentOrders && currentOrders.length > 0 && currentOrders.every((o) => selectedOrderIds.has(o.id));
  const toggleSelectAll = () => {
    if (!currentOrders) return;
    const allIds = currentOrders.map((o) => o.id);
    setSelectedOrderIds(allSelected ? new Set() : new Set(allIds));
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
          <h1 className="flex-1 text-lg font-bold">New Pick List</h1>
          {activeTab === 'sales' && (
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
          )}
        </div>

        {/* Tabs + Search row */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1 rounded-lg bg-fill-secondary p-0.5">
            <button
              type="button"
              onClick={() => handleTabChange('sales')}
              className={`flex-1 rounded-md px-2 py-2 text-[13px] font-semibold transition-colors ${
                activeTab === 'sales'
                  ? 'bg-fill-primary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Sales{filteredZohoOrders ? ` (${filteredZohoOrders.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('private')}
              className={`flex-1 rounded-md px-2 py-2 text-[13px] font-semibold transition-colors ${
                activeTab === 'private'
                  ? 'bg-fill-primary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Private{filteredPcoOrders ? ` (${filteredPcoOrders.length})` : ''}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
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
        {!isLoading && currentOrders && currentOrders.length > 1 && (
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
            {allSelected ? 'Deselect All' : `Select All (${currentOrders.length})`}
          </button>
        )}

        {/* Sales Orders List (Zoho) */}
        {activeTab === 'sales' && !isLoadingZoho && (
          <div>
            {filteredZohoOrders?.length === 0 ? (
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
                {filteredZohoOrders?.map((order, index) => {
                  const isSelected = selectedOrderIds.has(order.id);
                  const isExpanded = expandedOrderId === order.id;
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
                          <p className="truncate text-[13px] leading-tight text-text-muted">
                            {order.customerName ?? 'Unknown'}
                          </p>
                        </div>

                        {/* Case count — prominent */}
                        <div className="shrink-0 text-right">
                          <span className="text-[17px] font-bold tabular-nums leading-tight">
                            {order.totalQuantity}
                          </span>
                          <p className="text-[11px] leading-tight text-text-muted">
                            {order.totalQuantity === 1 ? 'case' : 'cases'}
                          </p>
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

                      {/* Expanded items */}
                      {isExpanded && (
                        <div className="border-t border-border-muted bg-fill-secondary/60 px-4 py-2">
                          {isLoadingZohoItems ? (
                            <div className="flex items-center justify-center py-2">
                              <IconLoader2 className="h-4 w-4 animate-spin text-text-muted" />
                            </div>
                          ) : expandedZohoOrder?.items.length ? (
                            <div className="space-y-0.5">
                              {expandedZohoOrder.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between py-0.5 text-[13px]"
                                >
                                  <span className="truncate text-text-primary">
                                    {item.name}
                                  </span>
                                  <span className="ml-2 shrink-0 font-semibold tabular-nums text-text-muted">
                                    x{item.quantity}
                                  </span>
                                </div>
                              ))}
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

        {/* Private Orders List (PCO) */}
        {activeTab === 'private' && !isLoadingPco && (
          <div>
            {filteredPcoOrders?.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Typography variant="headingSm" className="mb-2">
                    No Orders Available
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    There are no approved orders ready for picking
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border-primary">
                {filteredPcoOrders?.map((order, index) => {
                  const isSelected = selectedOrderIds.has(order.id);
                  const isExpanded = expandedOrderId === order.id;
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
                          <span className="text-[15px] font-bold leading-tight">
                            {order.orderNumber}
                          </span>
                          <p className="truncate text-[13px] leading-tight text-text-muted">
                            {order.clientName ?? 'Unknown'}
                          </p>
                        </div>

                        {/* Case count — prominent */}
                        <div className="shrink-0 text-right">
                          <span className="text-[17px] font-bold tabular-nums leading-tight">
                            {order.caseCount ?? 0}
                          </span>
                          <p className="text-[11px] leading-tight text-text-muted">
                            {(order.caseCount ?? 0) === 1 ? 'case' : 'cases'}
                          </p>
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

                      {/* Expanded items */}
                      {isExpanded && (
                        <div className="border-t border-border-muted bg-fill-secondary/60 px-4 py-2">
                          {isLoadingPcoItems ? (
                            <div className="flex items-center justify-center py-2">
                              <IconLoader2 className="h-4 w-4 animate-spin text-text-muted" />
                            </div>
                          ) : expandedPcoOrder?.items.length ? (
                            <div className="space-y-0.5">
                              {expandedPcoOrder.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between py-0.5 text-[13px]"
                                >
                                  <span className="truncate text-text-primary">
                                    {item.productName}
                                    {item.producer || item.vintage
                                      ? ` (${[item.producer, item.vintage].filter(Boolean).join(', ')})`
                                      : ''}
                                  </span>
                                  <span className="ml-2 shrink-0 font-semibold tabular-nums text-text-muted">
                                    x{item.quantity}
                                  </span>
                                </div>
                              ))}
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
