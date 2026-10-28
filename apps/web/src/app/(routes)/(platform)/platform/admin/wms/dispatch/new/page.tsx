'use client';

import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconFileText,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
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
import ClientMark from '@/app/_wms/components/ClientMark';
import useTRPC from '@/lib/trpc/browser';

type Step = 'select-orders' | 'confirm';

interface DispatchLine {
  productName: string;
  lwin18: string | null;
  /** Cases and bottles are counted separately — a split-case line is in bottles. */
  unit: 'cases' | 'bottles';
  requested: number;
  picked: number;
  isPicked: boolean;
}

interface SelectedOrder {
  id: string;
  type: 'zoho' | 'pco';
  orderNumber: string;
  /** The sales order, kept alongside the invoice number so both are findable. */
  salesOrderNumber: string | null;
  pickListNumber: string | null;
  customerName: string | null;
  /** The customer's partner logo, so an order is recognised before it is read. */
  logoUrl: string | null;
  /** What the list is sorted by — the Zoho order date, or the PCO's raised date. */
  orderedAt: Date | null;
  totalCases: number;
  pickedBottles: number;
  orderedCases: number;
  isShort: boolean;
  /** False while the pick is still being worked. */
  isPickComplete: boolean;
  pickedLines: number;
  totalLines: number;
  lines: DispatchLine[];
}

/**
 * Guided dispatch wizard — select orders, pick distributor, dispatch in 2 steps.
 */
const DispatchWizardPage = () => {
  const router = useRouter();
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('select-orders');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<SelectedOrder[]>([]);
  const [selectedDistributorId, setSelectedDistributorId] = useState<
    string | null
  >(null);
  const [generateDN, setGenerateDN] = useState(true);
  const [notes, setNotes] = useState('');

  // Fetch picked Zoho orders ready for dispatch
  /*
    Always refetch on mount. Dispatch is opened after work has happened
    elsewhere — a pick finished, an order released — so a cached list is stale
    by definition at the moment someone arrives to use it.
  */
  const { data: zohoOrders, isLoading: isLoadingZoho, refetch: refetchZoho } = useQuery({
    ...api.zohoSalesOrders.getPickedForDispatch.queryOptions({}),
    refetchOnMount: 'always',
  });

  // Fetch approved PCO orders
  const { data: pcoOrders, isLoading: isLoadingPco, refetch: refetchPco } = useQuery({
    ...api.privateClientOrders.adminGetMany.queryOptions({
      status: 'cc_approved',
      limit: 50,
    }),
    refetchOnMount: 'always',
  });

  // Fetch distributors
  const { data: distributors, isLoading: isLoadingDistributors } = useQuery({
    ...api.partners.list.queryOptions({ type: 'distributor' }),
  });

  // Sync Zoho orders
  const syncMutation = useMutation({
    ...api.zohoSalesOrders.sync.mutationOptions(),
    onSuccess: (data) => {
      // Refresh both sources: a Zoho sync changes what is ready to dispatch,
      // but the operator reads one list and does not care which half of it
      // went stale.
      void queryClient.invalidateQueries({
        queryKey: api.zohoSalesOrders.getPickedForDispatch.queryKey({}),
      });
      void refetchZoho();
      void refetchPco();
      toast.success(data.message);
    },
  });

  // Quick dispatch mutation
  const dispatchMutation = useMutation({
    ...api.wms.admin.dispatch.quickDispatch.mutationOptions(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries();
      router.push(`/platform/admin/wms/dispatch/${data.batch.id}`);
    },
    /*
      The server refuses to ship lines that never left the shelf through a
      scan (unscanned pick list lines, wine it cannot find) until someone says
      yes. Ask, and only then send it again with the yes.
    */
    onError: (error, variables) => {
      if (
        error.data?.code === 'PRECONDITION_FAILED' &&
        !variables.confirmUnpicked &&
        window.confirm(`${error.message}\n\nDispatch anyway?`)
      ) {
        dispatchMutation.mutate({ ...variables, confirmUnpicked: true });
      }
    },
  });

  // Build combined order list
  /*
    Both sources arrive sorted, but concatenating them does not stay sorted —
    it put every Zoho order ahead of every PCO regardless of date. The merged
    list is re-sorted here so the two read as one queue, newest first.
  */
  const allOrders: SelectedOrder[] = [
    ...(zohoOrders?.orders ?? []).map((o) => ({
      id: o.id,
      type: 'zoho' as const,
      orderNumber: o.invoiceNumber ?? o.salesOrderNumber,
      salesOrderNumber: o.salesOrderNumber,
      pickListNumber: o.pickListNumber,
      customerName: o.customerName,
      logoUrl: o.customerLogoUrl,
      orderedAt: o.orderDate ? new Date(o.orderDate) : null,
      totalCases: o.totalCases,
      pickedBottles: o.pickedBottles,
      orderedCases: o.orderedCases,
      isShort: o.isShort,
      isPickComplete: o.isPickComplete,
      pickedLines: o.pickedLines,
      totalLines: o.totalLines,
      lines: o.lines,
    })),
    ...(pcoOrders?.data ?? []).map((o) => ({
      id: o.id,
      type: 'pco' as const,
      orderNumber: o.orderNumber,
      salesOrderNumber: null,
      pickListNumber: null,
      customerName: o.clientName ?? null,
      // A PCO is for a private client; the partner who placed it carries the logo.
      logoUrl: o.partner?.logoUrl ?? null,
      orderedAt: o.createdAt ? new Date(o.createdAt) : null,
      totalCases: o.caseCount ?? 0,
      pickedBottles: 0,
      orderedCases: o.caseCount ?? 0,
      isShort: false,
      isPickComplete: true,
      pickedLines: 0,
      totalLines: 0,
      lines: [] as DispatchLine[],
    })),
  ].sort((a, b) => {
    // A missing date sorts last rather than jumping to the top of the queue.
    const at = a.orderedAt?.getTime() ?? -Infinity;
    const bt = b.orderedAt?.getTime() ?? -Infinity;
    if (at !== bt) return bt - at;
    return (b.orderNumber ?? '').localeCompare(a.orderNumber ?? '');
  });

  // Filter by search
  const filteredOrders = allOrders.filter((order) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    // Searching the contents matters as much as the reference: the question on
    // the dock is usually "which order has the Compass Box in it".
    return (
      order.orderNumber?.toLowerCase().includes(q) ||
      order.salesOrderNumber?.toLowerCase().includes(q) ||
      order.pickListNumber?.toLowerCase().includes(q) ||
      order.customerName?.toLowerCase().includes(q) ||
      order.lines.some((l) => l.productName.toLowerCase().includes(q))
    );
  });

  const isLoading = isLoadingZoho || isLoadingPco;
  const totalSelectedCases = selectedOrders.reduce(
    (sum, o) => sum + o.totalCases,
    0,
  );

  const toggleOrder = (order: SelectedOrder) => {
    setSelectedOrders((prev) => {
      const exists = prev.find((o) => o.id === order.id);
      if (exists) return prev.filter((o) => o.id !== order.id);
      return [...prev, order];
    });
  };

  const isSelected = (orderId: string) =>
    selectedOrders.some((o) => o.id === orderId);

  const handleDispatch = () => {
    if (!selectedDistributorId || selectedOrders.length === 0) return;
    dispatchMutation.mutate({
      distributorId: selectedDistributorId,
      orderIds: selectedOrders.map((o) => ({ id: o.id, type: o.type })),
      generateDeliveryNote: generateDN,
      notes: notes || undefined,
    });
  };

  // Filter distributors
  const filteredDistributors = distributors?.filter((d) =>
    searchQuery
      ? d.name?.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  /*
    Width: capped at max-w-2xl, which on the landscape tablet this runs on left
    two thirds of the screen empty and the order cards squeezed into a column.
    Widened from lg up only — the handheld stays a single column.
  */
  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-8 lg:max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          {step === 'select-orders' ? (
            <Link href="/platform/admin/wms/dispatch">
              <Button variant="ghost" className="h-12 w-12">
                <Icon icon={IconArrowLeft} size="sm" />
              </Button>
            </Link>
          ) : (
            <Button
              variant="ghost"
              className="h-12 w-12"
              onClick={() => {
                setStep('select-orders');
                setSearchQuery('');
              }}
            >
              <Icon icon={IconArrowLeft} size="sm" />
            </Button>
          )}
          <div className="flex-1">
            <Typography variant="headingMd">Dispatch Wizard</Typography>
            <Typography variant="bodySm" colorRole="muted">
              {step === 'select-orders'
                ? 'Step 1: Select orders to dispatch'
                : 'Step 2: Confirm and dispatch'}
            </Typography>
          </div>
          {step === 'select-orders' && (
            <Button
              variant="ghost"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <Icon
                icon={syncMutation.isPending ? IconLoader2 : IconRefresh}
                size="sm"
                className={syncMutation.isPending ? 'animate-spin' : ''}
              />
            </Button>
          )}
        </div>

        {/*
          Step indicator. The circles were drawn in brand-500, which the theme
          does not define, so step 1 rendered as an empty space beside a lone "2".
        */}
        <div className="flex items-center gap-3 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span
              className={`flex size-6 items-center justify-center rounded-full ${
                step === 'confirm'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-text-primary text-surface-primary'
              }`}
            >
              {step === 'confirm' ? <Icon icon={IconCheck} size="sm" /> : '1'}
            </span>
            <span className={step === 'select-orders' ? 'text-text-primary' : 'text-text-muted'}>
              Orders
            </span>
          </div>
          <div className="h-px flex-1 bg-border-muted">
            <div
              className={`h-full bg-emerald-500 transition-all ${step === 'confirm' ? 'w-full' : 'w-0'}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`flex size-6 items-center justify-center rounded-full ${
                step === 'confirm'
                  ? 'bg-text-primary text-surface-primary'
                  : 'bg-fill-secondary text-text-muted'
              }`}
            >
              2
            </span>
            <span className={step === 'confirm' ? 'text-text-primary' : 'text-text-muted'}>
              Distributor &amp; dispatch
            </span>
          </div>
        </div>

        {/* Step 1: Select Orders */}
        {step === 'select-orders' && (
          <>
            {/* Search */}
            <div className="relative">
              <Icon
                icon={IconSearch}
                size="sm"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order, customer, pick list or wine..."
                className="h-12 w-full rounded-xl border border-border-muted bg-surface-primary py-2 pl-11 pr-4 text-base shadow-sm focus:border-text-primary focus:outline-none focus:ring-2 focus:ring-text-primary/10"
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

            {/* Orders list */}
            {!isLoading && (
              // Two columns once there is room. A dispatch queue is scanned for
              // a known order, not read top to bottom, so more rows visible at
              // once is the whole job.
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {filteredOrders.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Typography variant="headingSm" className="mb-2">
                        No Orders Ready
                      </Typography>
                      <Typography variant="bodySm" colorRole="muted">
                        No picked orders available for dispatch
                      </Typography>
                    </CardContent>
                  </Card>
                ) : (
                  filteredOrders.map((order) => {
                    const selected = isSelected(order.id);
                    return (
                      <Card
                        key={order.id}
                        /*
                          Selection has to read across a room, not from a
                          ring that only shows up close: a selected card gets
                          a dark border and a filled tick. It is a real
                          control, so it takes focus and the keyboard.
                        */
                        className={`cursor-pointer rounded-xl shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary ${
                          selected
                            ? 'border-2 border-text-primary bg-surface-secondary/60'
                            : 'border border-border-muted hover:-translate-y-px hover:shadow-md'
                        }`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selected}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleOrder(order);
                          }
                        }}
                        onClick={() => toggleOrder(order)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <ClientMark logoUrl={order.logoUrl} name={order.customerName} size="lg" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-text-primary">
                                    {order.customerName ?? 'Unknown customer'}
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs font-medium text-text-primary">
                                      {order.orderNumber}
                                    </span>
                                    <span
                                      className={`rounded-full px-1.5 py-px text-[10px] font-medium ring-1 ring-inset ${
                                        order.type === 'zoho'
                                          ? 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:ring-slate-700'
                                          : 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:ring-violet-800'
                                      }`}
                                    >
                                      {order.type === 'zoho' ? (order.orderNumber.startsWith('INV') ? 'INV' : 'SO') : 'PCO'}
                                    </span>
                                  </div>
                                </div>
                                <span
                                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                    selected
                                      ? 'border-emerald-500 bg-emerald-500 text-white'
                                      : 'border-border-primary'
                                  }`}
                                >
                                  {selected && <Icon icon={IconCheck} size="sm" />}
                                </span>
                              </div>
                              {/*
                                Every reference the order is known by, on one
                                line, so it matches whichever number is on the
                                paperwork in the operator's hand.
                              */}
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-text-muted">
                                {order.salesOrderNumber &&
                                order.salesOrderNumber !== order.orderNumber ? (
                                  <span>{order.salesOrderNumber}</span>
                                ) : null}
                                {order.pickListNumber ? (
                                  <span>{order.pickListNumber}</span>
                                ) : null}
                                {/* The key the queue is sorted by, so the run order is readable. */}
                                {order.orderedAt ? (
                                  <span>{format(order.orderedAt, 'dd MMM yyyy')}</span>
                                ) : null}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold tabular-nums text-text-primary">
                                  {order.totalCases}{' '}
                                  <span className="text-xs font-normal text-text-muted">
                                    {order.totalCases === 1 ? 'case' : 'cases'}
                                  </span>
                                  {order.pickedBottles > 0 ? (
                                    <span className="text-xs font-normal text-text-muted">
                                      {' '}
                                      · {order.pickedBottles} btl
                                    </span>
                                  ) : null}
                                </span>
                                {!order.isPickComplete && order.totalLines > 0 ? (
                                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800">
                                    Still picking · {order.pickedLines}/{order.totalLines}
                                  </span>
                                ) : order.isShort ? (
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800">
                                    Short pick
                                  </span>
                                ) : null}
                                {order.lines.length > 0 ? (
                                  <button
                                    type="button"
                                    /* A plain grey "3 items" read as a label, not a
                                       control, so the contents looked gone. */
                                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-border-muted bg-surface-primary px-2.5 py-1 text-xs font-medium text-text-primary shadow-sm hover:bg-surface-secondary"
                                    onClick={(e) => {
                                      // The card itself toggles selection, so
                                      // opening the contents must not also tick it.
                                      e.stopPropagation();
                                      setExpandedOrderId((prev) =>
                                        prev === order.id ? null : order.id,
                                      );
                                    }}
                                  >
                                    {expandedOrderId === order.id
                                      ? 'Hide items'
                                      : `Show ${order.lines.length} item${order.lines.length === 1 ? '' : 's'}`}
                                    <Icon
                                      icon={expandedOrderId === order.id ? IconChevronUp : IconChevronDown}
                                      size="sm"
                                    />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {/*
                            What is actually going on the pallet. The wizard
                            showed a case count and nothing else, so checking
                            an order against the goods meant leaving the screen
                            and opening the pick.
                          */}
                          {expandedOrderId === order.id && order.lines.length > 0 ? (
                            <div
                              className="mt-3 border-t border-border-primary pt-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* 49-line orders exist; scroll the manifest rather than
                                  pushing every other order off the screen. */}
                              <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                                {order.lines.map((line, i) => (
                                  <div
                                    key={`${line.lwin18 ?? line.productName}-${i}`}
                                    className="flex items-start justify-between gap-3"
                                  >
                                    <div className="min-w-0">
                                      <Typography variant="bodyXs" className="break-words">
                                        {line.productName}
                                      </Typography>
                                      {line.lwin18 ? (
                                        <div className="font-mono text-[10px] text-text-muted">
                                          {line.lwin18}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <span className="font-mono text-xs tabular-nums">
                                        {line.picked}
                                        {line.picked < line.requested
                                          ? ` / ${line.requested}`
                                          : ''}
                                      </span>
                                      <span className="ml-1 text-[10px] text-text-muted">
                                        {line.unit === 'bottles' ? 'btl' : 'cs'}
                                      </span>
                                      {!line.isPicked ? (
                                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                          not picked
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {/* Bottom bar: Next */}
            {selectedOrders.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 border-t border-border-primary bg-fill-primary p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => {
                    setStep('confirm');
                    setSearchQuery('');
                  }}
                >
                  <ButtonContent iconRight={IconArrowRight}>
                    {selectedOrders.length} order
                    {selectedOrders.length !== 1 ? 's' : ''} selected (
                    {totalSelectedCases} cases)
                  </ButtonContent>
                </Button>
              </div>
            )}
          </>
        )}

        {/* Step 2: Confirm & Dispatch */}
        {step === 'confirm' && (
          <>
            {/* Selected orders summary */}
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Orders
                  </span>
                  <span className="rounded-full bg-fill-secondary px-1.5 text-[10px] font-semibold text-text-muted">
                    {selectedOrders.length}
                  </span>
                </div>
                <div className="divide-y divide-border-muted">
                  {selectedOrders.map((order) => (
                    <div key={order.id} className="flex items-center gap-3 py-2.5">
                      <ClientMark logoUrl={order.logoUrl} name={order.customerName} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-text-primary">
                          {order.customerName ?? 'Unknown customer'}
                        </div>
                        <div className="font-mono text-[10px] text-text-muted">
                          {[order.orderNumber, order.pickListNumber].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {order.totalCases}{' '}
                        <span className="text-xs font-normal text-text-muted">
                          {order.totalCases === 1 ? 'case' : 'cases'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-1 border-t border-border-muted pt-3">
                  <div className="flex justify-between">
                    <Typography variant="bodySm" className="font-semibold">
                      Total
                    </Typography>
                    <Typography variant="bodySm" className="font-semibold">
                      {totalSelectedCases} cases
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Distributor selection */}
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Distributor
                </div>

                {/* Search distributors */}
                <div className="relative mb-3">
                  <Icon
                    icon={IconSearch}
                    size="sm"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search distributors..."
                    className="h-11 w-full rounded-xl border border-border-muted bg-surface-primary py-2 pl-10 pr-4 text-sm focus:border-text-primary focus:outline-none focus:ring-2 focus:ring-text-primary/10"
                  />
                </div>

                {isLoadingDistributors ? (
                  <div className="flex items-center justify-center p-8">
                    <Icon
                      icon={IconLoader2}
                      className="animate-spin"
                      colorRole="muted"
                    />
                  </div>
                ) : (
                  <div className="max-h-80 space-y-1.5 overflow-y-auto p-0.5">
                    {filteredDistributors?.map((dist) => {
                      const selected = selectedDistributorId === dist.id;
                      return (
                        <button
                          key={dist.id}
                          type="button"
                          onClick={() => setSelectedDistributorId(dist.id)}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                            selected
                              ? 'border-text-primary bg-surface-secondary/60 ring-1 ring-text-primary'
                              : 'border-border-muted hover:bg-surface-secondary/50'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <ClientMark logoUrl={dist.logoUrl} name={dist.name} size="lg" />
                            <span className="truncate text-sm font-medium text-text-primary">
                              {dist.name}
                            </span>
                          </div>
                          <span
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                              selected
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-border-primary'
                            }`}
                          >
                            {selected && <Icon icon={IconCheck} size="sm" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* Generate delivery note toggle */}
                <label className="flex cursor-pointer items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon icon={IconFileText} size="sm" colorRole="muted" />
                    <Typography variant="bodySm">
                      Generate delivery note
                    </Typography>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={generateDN}
                    onClick={() => setGenerateDN(!generateDN)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      generateDN ? 'bg-text-primary' : 'bg-fill-secondary'
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface-primary shadow transition-transform ${
                        generateDN ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>

                {/* Notes */}
                <div>
                  <Typography
                    variant="bodyXs"
                    colorRole="muted"
                    className="mb-1"
                  >
                    Notes (optional)
                  </Typography>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Truck #42, driver name..."
                    rows={2}
                    className="w-full rounded-xl border border-border-muted bg-surface-primary p-3 text-sm focus:border-text-primary focus:outline-none focus:ring-2 focus:ring-text-primary/10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dispatch button */}
            <div className="fixed bottom-0 left-0 right-0 border-t border-border-primary bg-fill-primary p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
              <Button
                variant="default"
                className="w-full"
                onClick={handleDispatch}
                disabled={
                  !selectedDistributorId || dispatchMutation.isPending
                }
              >
                <ButtonContent
                  iconLeft={
                    dispatchMutation.isPending ? IconLoader2 : IconTruck
                  }
                >
                  {dispatchMutation.isPending
                    ? 'Dispatching...'
                    : `Dispatch ${selectedOrders.length} order${selectedOrders.length !== 1 ? 's' : ''}`}
                </ButtonContent>
              </Button>
              {dispatchMutation.isError && (
                <Typography
                  variant="bodyXs"
                  className="mt-2 text-center text-red-600"
                >
                  {dispatchMutation.error?.message}
                </Typography>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DispatchWizardPage;
