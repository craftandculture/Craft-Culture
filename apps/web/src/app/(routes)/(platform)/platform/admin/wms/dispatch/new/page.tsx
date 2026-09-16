'use client';

import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconFileText,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconTruck,
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

type Step = 'select-orders' | 'confirm';

interface DispatchLine {
  productName: string;
  lwin18: string | null;
  cases: number;
  picked: boolean;
}

interface SelectedOrder {
  id: string;
  type: 'zoho' | 'pco';
  orderNumber: string;
  /** The sales order, kept alongside the invoice number so both are findable. */
  salesOrderNumber: string | null;
  pickListNumber: string | null;
  customerName: string | null;
  totalCases: number;
  orderedCases: number;
  isShort: boolean;
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
  });

  // Build combined order list
  const allOrders: SelectedOrder[] = [
    ...(zohoOrders?.orders ?? []).map((o) => ({
      id: o.id,
      type: 'zoho' as const,
      orderNumber: o.invoiceNumber ?? o.salesOrderNumber,
      salesOrderNumber: o.salesOrderNumber,
      pickListNumber: o.pickListNumber,
      customerName: o.customerName,
      totalCases: o.totalCases,
      orderedCases: o.orderedCases,
      isShort: o.isShort,
      lines: o.lines,
    })),
    ...(pcoOrders?.data ?? []).map((o) => ({
      id: o.id,
      type: 'pco' as const,
      orderNumber: o.orderNumber,
      salesOrderNumber: null,
      pickListNumber: null,
      customerName: o.clientName ?? null,
      totalCases: o.caseCount ?? 0,
      orderedCases: o.caseCount ?? 0,
      isShort: false,
      lines: [] as DispatchLine[],
    })),
  ];

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

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-8">
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

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              step === 'select-orders'
                ? 'bg-brand-500 text-white'
                : 'bg-emerald-500 text-white'
            }`}
          >
            {step === 'confirm' ? (
              <Icon icon={IconCheck} size="sm" />
            ) : (
              '1'
            )}
          </div>
          <div className="h-0.5 flex-1 bg-border-primary">
            <div
              className={`h-full transition-all ${
                step === 'confirm' ? 'w-full bg-brand-500' : 'w-0'
              }`}
            />
          </div>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              step === 'confirm'
                ? 'bg-brand-500 text-white'
                : 'bg-fill-secondary text-text-muted'
            }`}
          >
            2
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
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders..."
                className="w-full rounded-lg border border-border-primary bg-fill-primary py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
              <div className="space-y-2">
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
                        className={`cursor-pointer transition-all ${
                          selected
                            ? 'border-2 border-brand-500 ring-2 ring-brand-500/20'
                            : 'hover:border-border-brand'
                        }`}
                        onClick={() => toggleOrder(order)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Typography
                                  variant="bodySm"
                                  className="font-semibold"
                                >
                                  {order.orderNumber}
                                </Typography>
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                    order.type === 'zoho'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                  }`}
                                >
                                  {order.type === 'zoho' ? (order.orderNumber.startsWith('INV') ? 'INV' : 'SO') : 'PCO'}
                                </span>
                              </div>
                              <Typography variant="bodyXs" colorRole="muted">
                                {order.customerName ?? 'Unknown customer'}
                              </Typography>
                              {/*
                                Every reference the order is known by, on one
                                line. The card showed whichever of the invoice
                                or SO number happened to exist, so two orders
                                for the same customer were told apart only by a
                                number that might not be the one written on the
                                paperwork in the operator's hand.
                              */}
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-text-muted">
                                {order.salesOrderNumber &&
                                order.salesOrderNumber !== order.orderNumber ? (
                                  <span>{order.salesOrderNumber}</span>
                                ) : null}
                                {order.pickListNumber ? (
                                  <span>{order.pickListNumber}</span>
                                ) : null}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Typography variant="bodyXs" colorRole="muted">
                                  {order.totalCases} cases
                                </Typography>
                                {order.isShort ? (
                                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                    short — {order.orderedCases} ordered
                                  </span>
                                ) : null}
                                {order.lines.length > 0 ? (
                                  <button
                                    type="button"
                                    className="text-[11px] font-medium text-text-brand underline-offset-2 hover:underline"
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
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded border-2 ${
                                selected
                                  ? 'border-brand-500 bg-brand-500'
                                  : 'border-border-primary'
                              }`}
                            >
                              {selected && (
                                <Icon
                                  icon={IconCheck}
                                  size="sm"
                                  className="text-white"
                                />
                              )}
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
                              <div className="flex flex-col gap-1.5">
                                {order.lines.map((line, i) => (
                                  <div
                                    key={`${line.lwin18 ?? line.productName}-${i}`}
                                    className="flex items-start justify-between gap-3"
                                  >
                                    <div className="min-w-0">
                                      <Typography variant="bodyXs" className="truncate">
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
                                        {line.cases}
                                      </span>
                                      {!line.picked ? (
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
                <Typography variant="headingSm" className="mb-3">
                  Orders ({selectedOrders.length})
                </Typography>
                <div className="space-y-2">
                  {selectedOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-lg bg-fill-secondary p-3"
                    >
                      <div>
                        <Typography variant="bodySm" className="font-medium">
                          {order.orderNumber}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {order.customerName}
                        </Typography>
                      </div>
                      <Typography variant="bodySm" colorRole="muted">
                        {order.totalCases} cases
                      </Typography>
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-border-primary pt-3">
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
                <Typography variant="headingSm" className="mb-3">
                  Distributor
                </Typography>

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
                    className="w-full rounded-lg border border-border-primary bg-fill-primary py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
                  <div className="max-h-60 space-y-2 overflow-y-auto">
                    {filteredDistributors?.map((dist) => {
                      const selected = selectedDistributorId === dist.id;
                      return (
                        <button
                          key={dist.id}
                          type="button"
                          onClick={() => setSelectedDistributorId(dist.id)}
                          className={`flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors ${
                            selected
                              ? 'bg-brand-100 ring-2 ring-brand-500 dark:bg-brand-900/30'
                              : 'bg-fill-secondary hover:bg-fill-secondary/70'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fill-brand/10">
                              <Icon
                                icon={IconTruck}
                                size="sm"
                                className="text-text-brand"
                              />
                            </div>
                            <Typography variant="bodySm" className="font-medium">
                              {dist.name}
                            </Typography>
                          </div>
                          <div
                            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                              selected
                                ? 'border-brand-500 bg-brand-500'
                                : 'border-border-primary'
                            }`}
                          >
                            {selected && (
                              <div className="h-2 w-2 rounded-full bg-white" />
                            )}
                          </div>
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
                      generateDN ? 'bg-brand-500' : 'bg-fill-secondary'
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
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
                    className="w-full rounded-lg border border-border-primary bg-fill-primary p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
