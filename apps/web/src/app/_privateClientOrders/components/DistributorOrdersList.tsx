'use client';

import {
  IconCheck,
  IconDots,
  IconDownload,
  IconEye,
  IconPackage,
  IconSearch,
  IconShieldCheck,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import AlertDialog from '@/app/_ui/components/AlertDialog/AlertDialog';
import AlertDialogAction from '@/app/_ui/components/AlertDialog/AlertDialogAction';
import AlertDialogCancel from '@/app/_ui/components/AlertDialog/AlertDialogCancel';
import AlertDialogContent from '@/app/_ui/components/AlertDialog/AlertDialogContent';
import AlertDialogDescription from '@/app/_ui/components/AlertDialog/AlertDialogDescription';
import AlertDialogFooter from '@/app/_ui/components/AlertDialog/AlertDialogFooter';
import AlertDialogHeader from '@/app/_ui/components/AlertDialog/AlertDialogHeader';
import AlertDialogTitle from '@/app/_ui/components/AlertDialog/AlertDialogTitle';
import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import DataTable from '@/app/_ui/components/DataTable/DataTable';
import DropdownMenu from '@/app/_ui/components/DropdownMenu/DropdownMenu';
import DropdownMenuContent from '@/app/_ui/components/DropdownMenu/DropdownMenuContent';
import DropdownMenuItem from '@/app/_ui/components/DropdownMenu/DropdownMenuItem';
import DropdownMenuSeparator from '@/app/_ui/components/DropdownMenu/DropdownMenuSeparator';
import DropdownMenuTrigger from '@/app/_ui/components/DropdownMenu/DropdownMenuTrigger';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import USD_TO_AED from '@/lib/currency/usdToAed';
import { useTRPCClient } from '@/lib/trpc/browser';

import type { DistributorQueue, DistributorStage } from '../constants';
import {
  DISTRIBUTOR_QUEUES,
  DISTRIBUTOR_SKU_LOCKED_STATUSES,
  DISTRIBUTOR_STAGES,
} from '../constants';
import PrivateOrderStatusBadge from './PrivateOrderStatusBadge';
import type { DistributorOrder } from '../utils/distributorOrderView';

type Currency = 'USD' | 'AED';

/** Default UAE exchange rate for AED/USD conversion */

type OrderWithPartner = DistributorOrder & {
  bottleCount: number;
  partner: { id: string; businessName: string; logoUrl: string | null } | null;
  client: { id: string; cityDrinksVerifiedAt: Date | null } | null;
};

/** The tabs are the dashboard's pipeline stages, so a tab and a count agree */
const stageTabs: { value: DistributorStage | 'all'; label: string }[] = [
  { value: 'all', label: 'All orders' },
  { value: 'verification', label: 'Verification' },
  { value: 'payment', label: 'Payment' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'delivered', label: 'Delivered' },
];

/** The queues shown as "Needs your action", in the order the work happens */
const actionQueues: DistributorQueue[] = ['verify', 'clientPayment', 'payCc', 'receive', 'deliver'];

/**
 * What happens next on an order, and whether it is the distributor's move
 *
 * Read from the status only, so the list can say it without loading each
 * order. The order page holds the buttons.
 */
const nextStepFor = (status: string): { label: string; yours: boolean } | null => {
  switch (status) {
    case 'awaiting_distributor_verification':
      return { label: 'Verify the client', yours: true };
    case 'verification_suspended':
      return { label: 'Unlock once the client is registered', yours: true };
    case 'awaiting_client_payment':
      return { label: 'Confirm client payment', yours: true };
    case 'awaiting_payment_verification':
      return { label: 'Verify client payment', yours: true };
    case 'client_paid':
      return { label: 'Raise payment to C&C', yours: true };
    case 'awaiting_distributor_payment':
      return { label: 'Confirm payment to C&C', yours: true };
    case 'distributor_paid':
      return { label: 'Waiting for C&C to send the stock', yours: false };
    case 'stock_in_transit':
      return { label: 'Confirm stock received', yours: true };
    case 'awaiting_partner_payment':
    case 'partner_paid':
    case 'with_distributor':
    case 'scheduling_delivery':
      return { label: 'Schedule delivery', yours: true };
    case 'delivery_scheduled':
      return { label: 'Mark out for delivery', yours: true };
    case 'out_for_delivery':
      return { label: 'Mark delivered', yours: true };
    default:
      return null;
  }
};

/** What each quick action records, shown before it is confirmed */
const actionConfirmCopy: Record<string, string> = {
  client_paid:
    'Confirm that the client has paid you in full. Your invoice must already be on the order. This cannot be undone from the portal.',
  awaiting_distributor_payment:
    'Record that your payment to Craft & Culture is being raised.',
  distributor_paid:
    'Confirm that your payment to Craft & Culture has been sent. Craft & Culture then releases the stock to you.',
  with_distributor:
    'Confirm that the stock for this order has arrived at your warehouse.',
};

/**
 * DistributorOrdersList displays a table of assigned orders
 * for distributors with action capabilities
 */
const DistributorOrdersList = () => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(0);
  // Orders per page — 20 or 50, remembered on this device
  const [pageSize, setPageSize] = useState<20 | 50>(20);
  useEffect(() => {
    try {
      if (window.localStorage.getItem('distributorOrders.pageSize') === '50') setPageSize(50);
    } catch {
      // Storage blocked: stay on 20
    }
  }, []);
  const changePageSize = (size: 20 | 50) => {
    setPageSize(size);
    setCursor(0);
    try {
      window.localStorage.setItem('distributorOrders.pageSize', String(size));
    } catch {
      // Storage blocked: the choice lasts until the page is left
    }
  };
  const [currency, setCurrency] = useState<Currency>('AED');
  const [stageFilter, setStageFilter] = useState<DistributorStage | 'all'>('all');
  // Set from dashboard links: a task queue, a missing SKU, or idle orders
  const [queueFilter, setQueueFilter] = useState<DistributorQueue | null>(null);
  const [skuMissingFilter, setSkuMissingFilter] = useState(false);
  const [idleFilter, setIdleFilter] = useState(false);

  // Dashboard links arrive as ?stage=, ?queue=, ?skuMissing=1, ?idle=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stage = params.get('stage');
    if (stage && stage in DISTRIBUTOR_STAGES) setStageFilter(stage as DistributorStage);
    const queue = params.get('queue');
    if (queue && queue in DISTRIBUTOR_QUEUES) setQueueFilter(queue as DistributorQueue);
    if (params.get('skuMissing') === '1') setSkuMissingFilter(true);
    if (params.get('idle') === '1') setIdleFilter(true);
  }, []);

  /** Clear a dashboard filter, and drop it from the address so a refresh agrees */
  const clearParam = (key: string) => {
    const params = new URLSearchParams(window.location.search);
    params.delete(key);
    const query = params.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
    setCursor(0);
  };

  /** Open one "Needs your action" queue, across all stages, as a dashboard tile does */
  const openQueue = (queue: DistributorQueue) => {
    const isActive = queueFilter === queue;
    const params = new URLSearchParams(window.location.search);
    params.delete('stage');
    if (isActive) params.delete('queue');
    else params.set('queue', queue);
    const query = params.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
    setStageFilter('all');
    setQueueFilter(isActive ? null : queue);
    setCursor(0);
  };

  // A quick action from the row menu waits here until it is confirmed
  const [pendingAction, setPendingAction] = useState<{
    orderId: string;
    orderNumber: string;
    label: string;
    status: string;
  } | null>(null);

  // Tab counts come from the dashboard, which counts the same status groups
  const { data: counts } = useQuery({
    queryKey: ['privateClientOrders.distributorDashboard'],
    queryFn: () => trpcClient.privateClientOrders.distributorDashboard.query(),
  });
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'privateClientOrders.distributorGetMany',
      {
        limit: pageSize,
        cursor,
        search: search || undefined,
        stageFilter,
        queueFilter,
        skuMissingFilter,
        idleFilter,
      },
    ],
    queryFn: () =>
      trpcClient.privateClientOrders.distributorGetMany.query({
        limit: pageSize,
        cursor,
        search: search || undefined,
        stage: stageFilter === 'all' ? undefined : stageFilter,
        queue: queueFilter ?? undefined,
        skuMissing: skuMissingFilter || undefined,
        idle: idleFilter || undefined,
      }),
  });

  // An order this distributor has received but not yet given its bundle SKU
  const requiresOrderSku = data?.meta.requiresOrderSku ?? false;
  const needsSku = (order: { distributorSku: string | null; status: string }) =>
    requiresOrderSku &&
    !order.distributorSku &&
    !DISTRIBUTOR_SKU_LOCKED_STATUSES.includes(order.status);
  // Counted across every order by the dashboard; this page's rows as a fallback
  const skuNeededCount = counts?.requiresOrderSku
    ? counts.queues.skuMissing
    : (data?.data ?? []).filter(needsSku).length;
  const hasFilters =
    stageFilter !== 'all' || !!queueFilter || skuMissingFilter || idleFilter || !!search;

  const updateStatus = useMutation({
    mutationFn: (params: { orderId: string; status: string }) =>
      trpcClient.privateClientOrders.distributorUpdateStatus.mutate({
        orderId: params.orderId,
        status: params.status as
          | 'awaiting_client_payment'
          | 'client_paid'
          | 'awaiting_distributor_payment'
          | 'distributor_paid'
          | 'stock_in_transit'
          | 'with_distributor'
          | 'out_for_delivery'
          | 'delivered',
      }),
    onSuccess: () => {
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
      setPendingAction(null);
      toast.success('Order status updated');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update status');
    },
  });

  const allOrders = data?.data ?? [];
  const totalCount = data?.meta?.totalCount ?? 0;
  const hasMore = data?.meta?.hasMore ?? false;

  const orders = allOrders;

  const toggleOrderSelection = (orderId: string) => {
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

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === orders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(orders.map((o) => o.id)));
    }
  };

  const handleDownloadSummary = async () => {
    if (selectedOrderIds.size === 0) return;
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ orderIds: Array.from(selectedOrderIds).join(',') });
      const response = await fetch(`/api/distributor/pco/summary?${params.toString()}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(err.error ?? 'Download failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Order-Summary-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Summary PDF downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download summary');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatCurrencyValue = (order: OrderWithPartner) => {
    const usdAmount = order.totalUsd ?? 0;
    let amount: number;
    if (currency === 'USD') {
      amount = usdAmount;
    } else {
      // At the fixed peg; stored AED totals before 28 Oct 2026 used 3.67
      amount = usdAmount * USD_TO_AED;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * Get available actions matching backend distributorTransitions exactly
   */
  const getAvailableActions = (order: OrderWithPartner) => {
    const actions: { label: string; status: string; icon: typeof IconCheck }[] = [];

    switch (order.status) {
      case 'awaiting_distributor_verification':
        // Distributor needs to verify client - this is handled by the verification UI
        // No action buttons here, verification is done via separate UI
        break;
      case 'awaiting_client_payment':
        // Distributor can confirm client payment received
        actions.push({
          label: 'Confirm Client Payment',
          status: 'client_paid',
          icon: IconCheck,
        });
        break;
      case 'client_paid':
        // After client pays, transition to awaiting distributor payment
        actions.push({
          label: 'Mark Awaiting Distributor Payment',
          status: 'awaiting_distributor_payment',
          icon: IconCheck,
        });
        break;
      case 'awaiting_distributor_payment':
        // Distributor confirms payment to C&C
        actions.push({
          label: 'Confirm Payment to C&C',
          status: 'distributor_paid',
          icon: IconCheck,
        });
        break;
      // distributor_paid: Wait for C&C admin to mark stock_in_transit - no action here
      case 'stock_in_transit':
        // Stock has arrived at distributor
        actions.push({
          label: 'Stock Received',
          status: 'with_distributor',
          icon: IconPackage,
        });
        break;
      // with_distributor and out_for_delivery actions are handled in order detail page
      // to ensure proper delivery scheduling workflow is followed
      case 'with_distributor':
      case 'out_for_delivery':
        // No quick actions - must go to order detail page for delivery workflow
        break;
    }

    return actions;
  };

  const columns: ColumnDef<OrderWithPartner>[] = [
    {
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          checked={orders.length > 0 && selectedOrderIds.size === orders.length}
          onChange={toggleSelectAll}
          aria-label="Select all orders on this page"
          className="h-5 w-5 rounded border-border-muted accent-text-primary"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedOrderIds.has(row.original.id)}
          onChange={() => toggleOrderSelection(row.original.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${row.original.orderNumber}`}
          className="h-5 w-5 rounded border-border-muted accent-text-primary"
        />
      ),
    },
    {
      accessorKey: 'orderNumber',
      header: 'Order #',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <Typography variant="bodySm" className="font-mono font-medium">
            {row.original.orderNumber}
          </Typography>
          {needsSku(row.original) && (
            <span className="w-fit rounded-full bg-fill-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-text-warning">
              SKU needed
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'clientName',
      header: 'Client',
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Typography variant="bodySm" className="font-medium">
              {row.original.clientName}
            </Typography>
            {row.original.client?.cityDrinksVerifiedAt && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400"
                title="Client verified by City Drinks"
              >
                <IconShieldCheck className="h-3 w-3" aria-hidden />
                CD
              </span>
            )}
          </div>
          {row.original.clientPhone && (
            <Typography variant="bodyXs" colorRole="muted">
              {row.original.clientPhone}
            </Typography>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'bottleCount',
      header: 'Bottles',
      cell: ({ row }) => (
        <Typography variant="bodySm" className="tabular-nums">
          {row.original.bottleCount}
        </Typography>
      ),
    },
    {
      accessorKey: 'total',
      header: () => <span>Total ({currency})</span>,
      cell: ({ row }) => (
        <Typography variant="bodySm" className="font-medium tabular-nums">
          {formatCurrencyValue(row.original)}
        </Typography>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status · next step',
      cell: ({ row }) => {
        const next = nextStepFor(row.original.status);
        return (
          <div className="flex flex-col items-start gap-1">
            <PrivateOrderStatusBadge status={row.original.status} />
            {next && (
              <Typography
                variant="bodyXs"
                className={next.yours ? 'font-medium text-text-warning' : 'text-text-muted'}
              >
                {next.label}
              </Typography>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'distributorAssignedAt',
      header: 'Assigned',
      cell: ({ row }) => (
        <Typography variant="bodyXs" colorRole="muted">
          {row.original.distributorAssignedAt
            ? format(new Date(row.original.distributorAssignedAt), 'MMM d, yyyy')
            : '-'}
        </Typography>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const availableActions = getAvailableActions(row.original);

        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Actions for ${row.original.orderNumber}`}
              >
                <Icon icon={IconDots} size="sm" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/platform/distributor/orders/${row.original.id}`}>
                  <Icon icon={IconEye} size="sm" className="mr-2" />
                  Open order
                </Link>
              </DropdownMenuItem>

              {availableActions.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {availableActions.map((action) => (
                    <DropdownMenuItem
                      key={action.status}
                      onSelect={() =>
                        setPendingAction({
                          orderId: row.original.id,
                          orderNumber: row.original.orderNumber,
                          label: action.label,
                          status: action.status,
                        })
                      }
                      disabled={updateStatus.isPending}
                    >
                      <Icon icon={action.icon} size="sm" className="mr-2" />
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const actionTotal = counts
    ? actionQueues.reduce((sum, queue) => sum + (counts.queues[queue] ?? 0), 0)
    : 0;

  const segmentClass = (isActive: boolean) =>
    `min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
      isActive
        ? 'bg-background-primary text-text-primary shadow-sm'
        : 'text-text-muted hover:text-text-primary'
    }`;

  return (
    <div className="flex flex-col gap-4">
      {/* Needs your action: the dashboard's task queues, one tap to the orders behind each */}
      {counts && (
        <div className="flex flex-col gap-2">
          <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wider">
            {actionTotal > 0 ? `Needs your action · ${actionTotal}` : 'Needs your action · all clear'}
          </Typography>
          {actionTotal > 0 && (
            <div className="flex flex-wrap gap-2">
              {actionQueues
                .filter((queue) => (counts.queues[queue] ?? 0) > 0)
                .map((queue) => {
                  const isActive = queueFilter === queue;
                  return (
                    <button
                      key={queue}
                      type="button"
                      onClick={() => openQueue(queue)}
                      aria-pressed={isActive}
                      className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'border-text-primary bg-text-primary text-surface-primary'
                          : 'border-fill-warning/50 bg-fill-warning/5 text-text-primary hover:bg-fill-warning/10'
                      }`}
                    >
                      {DISTRIBUTOR_QUEUES[queue].label}
                      <span className="tabular-nums font-semibold">{counts.queues[queue]}</span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {skuNeededCount > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-fill-warning/50 bg-fill-warning/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Typography variant="bodySm" className="font-medium">
              {skuNeededCount} order{skuNeededCount === 1 ? ' needs' : 's need'} your bundle SKU
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Create the bundle under the PCO number and enter its SKU on the order. Client
              payment cannot be confirmed until it is recorded.
            </Typography>
          </div>
          {!skuMissingFilter && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setSkuMissingFilter(true);
                setCursor(0);
              }}
            >
              Show these orders
            </Button>
          )}
        </div>
      )}

      {/* Pipeline stage tabs — filtered on the server, counted like the dashboard */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Order stage">
        {stageTabs.map((tab) => {
          const count =
            tab.value === 'all'
              ? counts?.kpis.totalOrders
              : counts?.stages[tab.value].count;
          const isActive = stageFilter === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setStageFilter(tab.value);
                clearParam('stage');
                setCursor(0);
              }}
              className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-text-primary text-surface-primary'
                  : 'bg-surface-secondary/50 text-text-muted hover:bg-surface-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
              {count !== undefined && (
                <Badge
                  size="sm"
                  colorRole={isActive ? 'brand' : 'muted'}
                  className={`tabular-nums ${isActive ? 'bg-surface-primary/20 text-surface-primary' : ''}`}
                >
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters opened from the dashboard, each removable */}
      {(queueFilter || skuMissingFilter || idleFilter) && (
        <div className="flex flex-wrap items-center gap-2">
          {[
            queueFilter && {
              key: 'queue',
              label: DISTRIBUTOR_QUEUES[queueFilter].label,
              clear: () => setQueueFilter(null),
            },
            skuMissingFilter && {
              key: 'skuMissing',
              label: 'SKU missing',
              clear: () => setSkuMissingFilter(false),
            },
            idleFilter && {
              key: 'idle',
              label: 'No change in 7 days',
              clear: () => setIdleFilter(false),
            },
          ]
            .filter((chip): chip is { key: string; label: string; clear: () => void } => !!chip)
            .map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => {
                  chip.clear();
                  clearParam(chip.key);
                }}
                aria-label={`Remove filter: ${chip.label}`}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border-muted bg-fill-muted/40 px-3 py-1 text-xs font-medium hover:bg-fill-muted"
              >
                {chip.label}
                <Icon icon={IconX} size="xs" />
              </button>
            ))}
        </div>
      )}

      {/* Header with search and currency toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <Icon
            icon={IconSearch}
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            type="search"
            placeholder="Search by order, client or phone"
            aria-label="Search orders by order number, client name or phone"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCursor(0);
            }}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Summary */}
          {selectedOrderIds.size > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadSummary}
              disabled={isDownloading}
              className="gap-1.5"
            >
              <Icon icon={IconDownload} size="sm" />
              {isDownloading ? 'Generating…' : `Download summary PDF (${selectedOrderIds.size})`}
            </Button>
          )}

          {/* Currency Toggle */}
          <div
            className="inline-flex items-center rounded-lg border border-border-muted bg-surface-secondary/50 p-0.5"
            role="group"
            aria-label="Currency"
          >
            {(['AED', 'USD'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                aria-pressed={currency === c}
                className={segmentClass(currency === c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Typography variant="bodySm" colorRole="muted">
            Loading orders…
          </Typography>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border-muted bg-surface-secondary/30 py-12">
          <Typography variant="bodySm" className="font-medium">
            The orders could not be loaded.
          </Typography>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border-muted bg-surface-secondary/30 py-12">
          <Icon icon={IconPackage} size="lg" className="text-text-muted" />
          <div className="px-4 text-center">
            <Typography variant="bodySm" className="font-medium">
              {hasFilters ? 'No orders match these filters' : 'No assigned orders'}
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              {hasFilters
                ? 'Clear a filter, choose another stage or change the search.'
                : 'Orders appear here when Craft & Culture assigns them to you.'}
            </Typography>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <DataTable columns={columns} data={orders} />
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col divide-y divide-border-muted rounded-lg border border-border-muted md:hidden">
            {orders.map((order) => {
              const next = nextStepFor(order.status);
              return (
                <div
                  key={order.id}
                  className="flex gap-3 p-4 transition-colors hover:bg-surface-secondary/50"
                >
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.has(order.id)}
                    onChange={() => toggleOrderSelection(order.id)}
                    aria-label={`Select ${order.orderNumber}`}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-border-muted accent-text-primary"
                  />
                  <Link
                    href={`/platform/distributor/orders/${order.id}`}
                    className="flex min-w-0 flex-1 flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Typography variant="bodySm" className="font-mono font-medium">
                          {order.orderNumber}
                        </Typography>
                        {needsSku(order) && (
                          <span className="mt-0.5 inline-block rounded-full bg-fill-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-text-warning">
                            SKU needed
                          </span>
                        )}
                      </div>
                      <PrivateOrderStatusBadge status={order.status} />
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Typography variant="bodySm" className="truncate font-medium">
                        {order.clientName}
                      </Typography>
                      {order.client?.cityDrinksVerifiedAt && (
                        <span
                          className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-green-100 px-1 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          title="Client verified by City Drinks"
                          aria-label="Client verified by City Drinks"
                        >
                          <Icon icon={IconShieldCheck} size="xs" />
                        </span>
                      )}
                    </div>
                    {order.clientPhone && (
                      <Typography variant="bodyXs" colorRole="muted">
                        {order.clientPhone}
                      </Typography>
                    )}
                    <div className="flex items-center justify-between">
                      <Typography variant="bodyXs" colorRole="muted" className="tabular-nums">
                        {order.bottleCount} {order.bottleCount === 1 ? 'bottle' : 'bottles'}
                      </Typography>
                      <Typography variant="bodySm" className="font-semibold tabular-nums">
                        {formatCurrencyValue(order)}
                      </Typography>
                    </div>
                    {next && (
                      <Typography
                        variant="bodyXs"
                        className={next.yours ? 'font-medium text-text-warning' : 'text-text-muted'}
                      >
                        {next.yours ? 'Next: ' : ''}
                        {next.label}
                      </Typography>
                    )}
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Typography variant="bodyXs" colorRole="muted" className="tabular-nums">
              Showing {cursor + 1}–{Math.min(cursor + orders.length, totalCount)} of {totalCount}
            </Typography>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex items-center rounded-lg border border-border-muted bg-surface-secondary/50 p-0.5"
                role="group"
                aria-label="Orders per page"
              >
                {([20, 50] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => changePageSize(size)}
                    aria-pressed={pageSize === size}
                    className={`min-h-9 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                      pageSize === size
                        ? 'bg-background-primary text-text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {size} per page
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setCursor(Math.max(0, cursor - pageSize))}
                disabled={cursor === 0}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setCursor(cursor + pageSize)}
                disabled={!hasMore}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Quick actions change the order for everyone, so each is confirmed first */}
      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => {
          if (!open && !updateStatus.isPending) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.label} · {pendingAction?.orderNumber}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction ? actionConfirmCopy[pendingAction.status] ?? '' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={updateStatus.isPending}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                colorRole="brand"
                disabled={updateStatus.isPending}
                onClick={(event) => {
                  // Stay open until the change lands, so a failure is seen here
                  event.preventDefault();
                  if (pendingAction) {
                    updateStatus.mutate({
                      orderId: pendingAction.orderId,
                      status: pendingAction.status,
                    });
                  }
                }}
              >
                {updateStatus.isPending ? 'Saving…' : 'Confirm'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DistributorOrdersList;
