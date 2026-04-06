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
  IconSquare,
  IconSquareCheck,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
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
    const results = await Promise.allSettled(
      ids.map((id) =>
        activeTab === 'sales'
          ? releaseToPickMutation.mutateAsync({ salesOrderId: id })
          : createPcoMutation.mutateAsync({ orderId: id }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

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

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/platform/admin/wms/pick"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fill-secondary text-text-muted transition-colors hover:bg-fill-primary hover:text-text-primary active:bg-fill-secondary"
          >
            <IconArrowLeft className="h-6 w-6" />
          </Link>
          <div className="flex-1">
            <Typography variant="headingMd">New Pick List</Typography>
            <Typography variant="bodySm" colorRole="muted">
              Select orders to release for picking
            </Typography>
          </div>
          {activeTab === 'sales' && (
            <button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fill-secondary text-text-muted transition-colors hover:bg-fill-primary hover:text-text-primary active:bg-fill-secondary disabled:opacity-50"
            >
              {syncMutation.isPending ? (
                <IconLoader2 className="h-5 w-5 animate-spin" />
              ) : (
                <IconRefresh className="h-5 w-5" />
              )}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-fill-secondary p-1">
          <button
            type="button"
            onClick={() => handleTabChange('sales')}
            className={`flex-1 rounded-md px-3 py-3 text-sm font-medium transition-colors ${
              activeTab === 'sales'
                ? 'bg-fill-primary text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Sales Orders{filteredZohoOrders ? ` (${filteredZohoOrders.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('private')}
            className={`flex-1 rounded-md px-3 py-3 text-sm font-medium transition-colors ${
              activeTab === 'private'
                ? 'bg-fill-primary text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Private Orders{filteredPcoOrders ? ` (${filteredPcoOrders.length})` : ''}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Icon
            icon={IconSearch}
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
            className="w-full rounded-lg border border-border-primary bg-fill-primary py-3 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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

        {/* Sales Orders List (Zoho) */}
        {activeTab === 'sales' && !isLoadingZoho && (
          <div className="space-y-2">
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
              <>
                {/* Select All */}
                {filteredZohoOrders && filteredZohoOrders.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = filteredZohoOrders.map((o) => o.id);
                      const allSelected = allIds.every((id) =>
                        selectedOrderIds.has(id),
                      );
                      setSelectedOrderIds(
                        allSelected ? new Set() : new Set(allIds),
                      );
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-text-muted hover:bg-fill-secondary"
                  >
                    <Icon
                      icon={
                        filteredZohoOrders.every((o) =>
                          selectedOrderIds.has(o.id),
                        )
                          ? IconSquareCheck
                          : IconSquare
                      }
                      size="sm"
                    />
                    Select All ({filteredZohoOrders.length})
                  </button>
                )}
                {filteredZohoOrders?.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  return (
                    <Card
                      key={order.id}
                      className={`cursor-pointer transition-all ${
                        selectedOrderIds.has(order.id)
                          ? 'border-2 border-brand-500 ring-2 ring-brand-500/20'
                          : 'hover:border-border-brand'
                      }`}
                      onClick={() => toggleOrder(order.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Typography
                              variant="bodySm"
                              className="font-semibold"
                            >
                              {order.invoiceNumber ?? order.salesOrderNumber}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              {order.customerName ?? 'Unknown customer'}
                            </Typography>
                            {order.invoiceNumber && (
                              <Typography variant="bodyXs" colorRole="muted">
                                {order.salesOrderNumber}
                              </Typography>
                            )}
                            <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                              <span>{order.itemCount} items</span>
                              <span>{order.totalQuantity} cases</span>
                              <span>
                                {new Date(
                                  order.createdAt,
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div
                            className={`flex h-6 w-6 items-center justify-center rounded ${
                              selectedOrderIds.has(order.id)
                                ? 'bg-brand-500 text-white'
                                : 'border-2 border-border-primary'
                            }`}
                          >
                            {selectedOrderIds.has(order.id) && (
                              <Icon icon={IconCheck} size="xs" />
                            )}
                          </div>
                        </div>
                        {/* View Items toggle */}
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(e, order.id)}
                          className="mt-2 flex w-full items-center gap-1 py-2 text-sm font-medium text-brand-500 hover:text-brand-600"
                        >
                          <Icon
                            icon={isExpanded ? IconChevronUp : IconChevronDown}
                            size="xs"
                          />
                          {isExpanded ? 'Hide Items' : 'View Items'}
                        </button>
                        {/* Expanded items */}
                        {isExpanded && (
                          <div className="mt-2 rounded-md bg-fill-secondary p-3">
                            {isLoadingZohoItems ? (
                              <div className="flex items-center justify-center py-2">
                                <Icon
                                  icon={IconLoader2}
                                  size="xs"
                                  className="animate-spin text-text-muted"
                                />
                              </div>
                            ) : expandedZohoOrder?.items.length ? (
                              <div className="space-y-1.5">
                                {expandedZohoOrder.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <span className="truncate text-text-primary">
                                      {item.name}
                                    </span>
                                    <span className="ml-2 shrink-0 text-text-muted">
                                      x{item.quantity}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <Typography
                                variant="bodyXs"
                                colorRole="muted"
                                className="text-center"
                              >
                                No items
                              </Typography>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Private Orders List (PCO) */}
        {activeTab === 'private' && !isLoadingPco && (
          <div className="space-y-2">
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
              <>
                {/* Select All */}
                {filteredPcoOrders && filteredPcoOrders.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = filteredPcoOrders.map((o) => o.id);
                      const allSelected = allIds.every((id) =>
                        selectedOrderIds.has(id),
                      );
                      setSelectedOrderIds(
                        allSelected ? new Set() : new Set(allIds),
                      );
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-text-muted hover:bg-fill-secondary"
                  >
                    <Icon
                      icon={
                        filteredPcoOrders.every((o) =>
                          selectedOrderIds.has(o.id),
                        )
                          ? IconSquareCheck
                          : IconSquare
                      }
                      size="sm"
                    />
                    Select All ({filteredPcoOrders.length})
                  </button>
                )}
                {filteredPcoOrders?.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  return (
                    <Card
                      key={order.id}
                      className={`cursor-pointer transition-all ${
                        selectedOrderIds.has(order.id)
                          ? 'border-2 border-brand-500 ring-2 ring-brand-500/20'
                          : 'hover:border-border-brand'
                      }`}
                      onClick={() => toggleOrder(order.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Typography
                              variant="bodySm"
                              className="font-semibold"
                            >
                              {order.orderNumber}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              {order.clientName ?? 'Unknown client'}
                            </Typography>
                            <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                              <span>{order.itemCount ?? 0} items</span>
                              <span>{order.caseCount ?? 0} cases</span>
                              <span>
                                {new Date(
                                  order.createdAt,
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div
                            className={`flex h-6 w-6 items-center justify-center rounded ${
                              selectedOrderIds.has(order.id)
                                ? 'bg-brand-500 text-white'
                                : 'border-2 border-border-primary'
                            }`}
                          >
                            {selectedOrderIds.has(order.id) && (
                              <Icon icon={IconCheck} size="xs" />
                            )}
                          </div>
                        </div>
                        {/* View Items toggle */}
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(e, order.id)}
                          className="mt-2 flex w-full items-center gap-1 py-2 text-sm font-medium text-brand-500 hover:text-brand-600"
                        >
                          <Icon
                            icon={isExpanded ? IconChevronUp : IconChevronDown}
                            size="xs"
                          />
                          {isExpanded ? 'Hide Items' : 'View Items'}
                        </button>
                        {/* Expanded items */}
                        {isExpanded && (
                          <div className="mt-2 rounded-md bg-fill-secondary p-3">
                            {isLoadingPcoItems ? (
                              <div className="flex items-center justify-center py-2">
                                <Icon
                                  icon={IconLoader2}
                                  size="xs"
                                  className="animate-spin text-text-muted"
                                />
                              </div>
                            ) : expandedPcoOrder?.items.length ? (
                              <div className="space-y-1.5">
                                {expandedPcoOrder.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <span className="truncate text-text-primary">
                                      {item.productName}
                                      {item.producer || item.vintage
                                        ? ` (${[item.producer, item.vintage].filter(Boolean).join(', ')})`
                                        : ''}
                                    </span>
                                    <span className="ml-2 shrink-0 text-text-muted">
                                      x{item.quantity}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <Typography
                                variant="bodyXs"
                                colorRole="muted"
                                className="text-center"
                              >
                                No items
                              </Typography>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Create Button */}
        {selectedOrderIds.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-border-primary bg-fill-primary p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
            <Button
              variant="default"
              className="w-full"
              onClick={handleCreate}
              disabled={isCreating}
            >
              <ButtonContent
                iconLeft={isCreating ? IconLoader2 : IconPlus}
              >
                {isCreating
                  ? 'Releasing...'
                  : `Release ${selectedOrderIds.size} Order${selectedOrderIds.size === 1 ? '' : 's'} to Pick`}
              </ButtonContent>
            </Button>
            {createError && (
              <Typography
                variant="bodyXs"
                className="mt-2 text-center text-red-600"
              >
                {createError}
              </Typography>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewPickListPage;
