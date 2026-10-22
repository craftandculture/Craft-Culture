'use client';

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconEdit,
  IconFileInvoice,
  IconGitCompare,
  IconLoader2,
  IconPlus,
  IconShip,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  input as inputClass,
  label as labelClass,
  pillClass,
  primaryButton,
  secondaryButton,
} from '@/app/_logistics/components/exports/exportUi';
import type { ShipmentType } from '@/app/_logistics/components/ShipmentTypeBadge';
import { shipmentTypeConfig } from '@/app/_logistics/components/ShipmentTypeBadge';
import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import TextArea from '@/app/_ui/components/TextArea/TextArea';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { logisticsQuoteStatus, logisticsTransportMode } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type QuoteStatus = (typeof logisticsQuoteStatus.enumValues)[number];
type TransportMode = (typeof logisticsTransportMode.enumValues)[number];
type AcceptMode = 'create' | 'link' | 'none';

const statusBadgeVariants: Record<QuoteStatus, 'muted' | 'warning' | 'success' | 'danger'> = {
  draft: 'muted',
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
  expired: 'muted',
};

const transportModeOptions: { value: TransportMode; label: string }[] = [
  { value: 'sea_fcl', label: 'Sea (FCL)' },
  { value: 'sea_lcl', label: 'Sea (LCL)' },
  { value: 'air', label: 'Air' },
  { value: 'road', label: 'Road' },
];

const shipmentTypes: ShipmentType[] = ['inbound', 'outbound', 're_export', 'mainland_transfer'];

/** The most quotes the comparison screen sets side by side */
const MAX_COMPARE = 5;

/**
 * Whether a country names the UAE, as typed on requests and quotes
 *
 * @param country - Country as entered
 * @returns True for the UAE under its usual spellings
 */
const isUae = (country: string | null | undefined) =>
  !!country && /^(uae|u\.a\.e\.?|united arab emirates|dubai|abu dhabi|ras al khaimah|sharjah)$/i.test(country.trim());

/**
 * The shipment direction a quote's route suggests
 *
 * Most freight C&C buys is inbound to the UAE, so that is the default; a route
 * leaving the UAE reads as a re-export, and one within it as a mainland
 * transfer. The operator can change it before accepting.
 *
 * @param origin - Origin country
 * @param destination - Destination country
 * @returns The suggested shipment type
 */
const suggestShipmentType = (origin: string | null | undefined, destination: string | null | undefined): ShipmentType => {
  if (isUae(origin) && isUae(destination)) return 'mainland_transfer';
  if (isUae(origin) && destination) return 're_export';
  return 'inbound';
};

const statusIcons: Record<QuoteStatus, typeof IconClock> = {
  draft: IconFileInvoice,
  pending: IconClock,
  accepted: IconCheck,
  rejected: IconX,
  expired: IconAlertTriangle,
};

const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

const formatDate = (date: Date | null | undefined) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Quote detail page
 */
const QuoteDetailPage = () => {
  const params = useParams();
  const quoteId = params.quoteId as string;
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showAcceptPanel, setShowAcceptPanel] = useState(false);
  const [acceptMode, setAcceptMode] = useState<AcceptMode>('create');
  const [linkShipmentId, setLinkShipmentId] = useState('');
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [newShipmentType, setNewShipmentType] = useState<ShipmentType>('inbound');
  const [newTransportMode, setNewTransportMode] = useState<TransportMode | ''>('');

  const { data: quote, isLoading } = useQuery({
    ...api.logistics.admin.quotes.getOne.queryOptions({ id: quoteId }),
  });

  // The other quotes for the same request (or, failing that, the same shipment)
  const { data: siblingData } = useQuery({
    ...api.logistics.admin.quotes.getMany.queryOptions({
      limit: 50,
      requestId: quote?.requestId ?? undefined,
      shipmentId: quote?.requestId ? undefined : (quote?.shipmentId ?? undefined),
    }),
    enabled: !!quote && !!(quote.requestId || quote.shipmentId),
  });

  // Open shipments to link to, searched by number or route
  const { data: shipmentData, isFetching: isFetchingShipments } = useQuery({
    ...api.logistics.admin.getMany.queryOptions({
      limit: 25,
      stage: 'active',
      search: shipmentSearch || undefined,
    }),
    enabled: showAcceptPanel && acceptMode === 'link',
  });

  const { mutate: acceptQuote, isPending: isAccepting } = useMutation({
    ...api.logistics.admin.quotes.accept.mutationOptions(),
    onSuccess: (result) => {
      const parts = ['Quote accepted'];
      if (result.createdShipmentNumber) parts.push(`shipment ${result.createdShipmentNumber} opened`);
      if (result.freightCostRecorded) parts.push('freight cost recorded');
      if (result.requestCompleted) parts.push('request marked complete');
      toast.success(parts.join(', '));
      if (result.shipmentId && !result.freightCostRecorded) {
        toast.warning(
          `The freight cost was not recorded: no exchange rate was found for ${result.currency}. Add it to the shipment's costs by hand.`,
        );
      }
      setShowAcceptPanel(false);
      if (quote?.request) toast.info('The award and decline emails are ready on the request page');
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'quotes']] });
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests']] });
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getMany']] });
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getDashboardMetrics']] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to accept quote');
    },
  });

  const { mutate: rejectQuote, isPending: isRejecting } = useMutation({
    ...api.logistics.admin.quotes.reject.mutationOptions(),
    onSuccess: () => {
      toast.success('Quote rejected');
      setShowRejectDialog(false);
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'quotes']] });
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getDashboardMetrics']] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reject quote');
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Icon icon={IconFileInvoice} size="xl" className="mx-auto mb-4 text-text-muted" />
            <Typography variant="headingSm" className="mb-2">
              Quote Not Found
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              This quote may have been deleted or does not exist.
            </Typography>
            <Button className="mt-4" asChild>
              <Link href="/platform/admin/logistics/quotes">Back to freight quotes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = statusIcons[quote.status];
  const isEditable = quote.status === 'draft' || quote.status === 'pending';
  const canAcceptReject = quote.status === 'pending';

  // Group line items by category
  const lineItemsByCategory = quote.lineItems.reduce(
    (acc, item) => {
      (acc[item.category] ??= []).push(item);
      return acc;
    },
    {} as Record<string, typeof quote.lineItems>,
  );

  // Compare this quote with the others for its request or shipment, leaving
  // out rejected and expired ones first when there are more than fit
  const others = (siblingData?.quotes ?? [])
    .filter((q) => q.id !== quote.id)
    .sort((a, b) => Number(a.status === 'rejected' || a.status === 'expired') - Number(b.status === 'rejected' || b.status === 'expired'));
  const compareIds = [quote.id, ...others.slice(0, MAX_COMPARE - 1).map((q) => q.id)];
  const backHref = quote.request
    ? `/platform/admin/logistics/requests/${quote.request.id}`
    : '/platform/admin/logistics/quotes';

  const routeOrigin = quote.originCountry || quote.request?.originCountry;
  const routeDestination = quote.destinationCountry || quote.request?.destinationCountry;
  const defaultTransportMode = quote.transportMode ?? quote.request?.transportMode ?? '';
  const shipments = shipmentData?.data ?? [];

  const openAcceptPanel = () => {
    setAcceptMode(quote.shipmentId ? 'link' : 'create');
    setLinkShipmentId(quote.shipmentId ?? '');
    setNewShipmentType(suggestShipmentType(routeOrigin, routeDestination));
    setNewTransportMode(defaultTransportMode);
    setShowAcceptPanel(true);
  };

  const confirmAccept = () => {
    if (acceptMode === 'link') {
      if (!linkShipmentId) {
        toast.error('Choose the shipment this quote is for');
        return;
      }
      acceptQuote({ quoteId: quote.id, shipmentId: linkShipmentId });
      return;
    }
    if (acceptMode === 'create') {
      if (!newTransportMode) {
        toast.error('Choose a transport mode for the new shipment');
        return;
      }
      acceptQuote({
        quoteId: quote.id,
        createShipment: { type: newShipmentType, transportMode: newTransportMode },
      });
      return;
    }
    acceptQuote({ quoteId: quote.id, updateShipmentCosts: false });
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href={backHref}>
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Typography variant="headingLg">{quote.quoteNumber}</Typography>
                <Badge colorRole={statusBadgeVariants[quote.status]}>
                  <Icon icon={StatusIcon} size="xs" className="mr-1" />
                  {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                </Badge>
              </div>
              <Typography variant="bodySm" colorRole="muted">
                Created {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
                {quote.request && (
                  <>
                    {' · for request '}
                    <Link
                      href={`/platform/admin/logistics/requests/${quote.request.id}`}
                      className="font-mono underline-offset-2 hover:underline"
                    >
                      {quote.request.requestNumber}
                    </Link>
                  </>
                )}
              </Typography>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(isEditable || quote.status === 'expired') && quote.requestId && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/platform/admin/logistics/requests/${quote.requestId}?editQuote=${quote.id}`}>
                  <ButtonContent iconLeft={IconEdit}>Edit</ButtonContent>
                </Link>
              </Button>
            )}
            {others.length > 0 && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/platform/admin/logistics/quotes/compare?ids=${compareIds.join(',')}`}>
                  <ButtonContent iconLeft={IconGitCompare}>
                    Compare with other quotes ({others.length})
                  </ButtonContent>
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Actions for pending quotes */}
        {canAcceptReject && !showAcceptPanel && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Typography variant="bodySm" colorRole="muted">
                  {quote.validUntil && new Date(quote.validUntil).getTime() < Date.now()
                    ? `This quote was valid until ${formatDate(quote.validUntil)}. Ask the forwarder to confirm or reissue it; it cannot be accepted as it stands.`
                    : 'This quote is pending review. Accept or reject it.'}
                </Typography>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={isRejecting}
                  >
                    <ButtonContent iconLeft={IconX}>Reject</ButtonContent>
                  </Button>
                  <button type="button" className={primaryButton} onClick={openAcceptPanel}>
                    <IconCheck size={16} /> Accept quote
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Accept: say which shipment the freight is for */}
        {canAcceptReject && showAcceptPanel && (
          <Card>
            <div className="p-4 pb-0">
              <CardTitle>Accept quote {quote.quoteNumber}</CardTitle>
              <Typography variant="bodySm" colorRole="muted" className="mt-1">
                {formatCurrency(quote.totalPrice, quote.currency)} from {quote.forwarderName} is recorded
                as the shipment&apos;s freight cost.
                {quote.request && ` Request ${quote.request.requestNumber} is marked complete.`}
                {others.some((q) => q.status === 'pending') &&
                  ' The other pending quotes for this request are rejected.'}
              </Typography>
            </div>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Shipment">
                {(
                  [
                    ['create', 'Create shipment from this quote'],
                    ['link', 'Link to existing shipment'],
                    ['none', 'No shipment yet'],
                  ] as const
                ).map(([mode, text]) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={acceptMode === mode}
                    onClick={() => setAcceptMode(mode)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      acceptMode === mode
                        ? 'bg-text-primary text-surface-primary'
                        : 'bg-surface-muted text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>

              {acceptMode === 'create' && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass} htmlFor="newShipmentType">
                        Shipment type
                      </label>
                      <select
                        id="newShipmentType"
                        className={inputClass}
                        value={newShipmentType}
                        onChange={(e) => setNewShipmentType(e.target.value as ShipmentType)}
                      >
                        {shipmentTypes.map((t) => (
                          <option key={t} value={t}>
                            {shipmentTypeConfig[t].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="newTransportMode">
                        Transport mode
                      </label>
                      <select
                        id="newTransportMode"
                        className={inputClass}
                        value={newTransportMode}
                        onChange={(e) => setNewTransportMode(e.target.value as TransportMode | '')}
                      >
                        <option value="">Choose a mode</option>
                        {transportModeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Typography variant="bodySm" colorRole="muted">
                    A draft shipment is opened for {quote.originCity || routeOrigin || 'the origin'} →{' '}
                    {quote.destinationCity || routeDestination || 'the destination'}, with {quote.forwarderName} as
                    carrier.
                  </Typography>
                </div>
              )}

              {acceptMode === 'link' && (
                <div className="space-y-2">
                  <input
                    className={inputClass}
                    placeholder="Search shipment number or route"
                    value={shipmentSearch}
                    onChange={(e) => setShipmentSearch(e.target.value)}
                  />
                  <div className="max-h-64 divide-y divide-border-muted overflow-y-auto rounded-lg border border-border-muted">
                    {isFetchingShipments && shipments.length === 0 ? (
                      <p className="p-3 text-sm text-text-muted">Loading shipments…</p>
                    ) : shipments.length === 0 ? (
                      <p className="p-3 text-sm text-text-muted">No open shipments match.</p>
                    ) : (
                      shipments.map((s) => (
                        <label
                          key={s.id}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-secondary/50"
                        >
                          <input
                            type="radio"
                            name="linkShipment"
                            checked={linkShipmentId === s.id}
                            onChange={() => setLinkShipmentId(s.id)}
                          />
                          <span className="font-mono text-xs text-text-muted">{s.shipmentNumber}</span>
                          <span className="min-w-0 flex-1 truncate">
                            {s.name ? `${s.name} · ` : ''}
                            {s.originCity || s.originCountry || '—'} → {s.destinationCity || s.destinationCountry || '—'}
                          </span>
                          <span className={pillClass('slate')}>{shipmentTypeConfig[s.type].label}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              {acceptMode === 'none' && (
                <Typography variant="bodySm" colorRole="muted">
                  The quote is accepted without a shipment. Link it to one later to record the freight cost.
                </Typography>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => setShowAcceptPanel(false)}
                  disabled={isAccepting}
                >
                  Cancel
                </button>
                <button type="button" className={primaryButton} onClick={confirmAccept} disabled={isAccepting}>
                  {isAccepting ? (
                    <IconLoader2 size={16} className="animate-spin" />
                  ) : acceptMode === 'create' ? (
                    <IconPlus size={16} />
                  ) : (
                    <IconCheck size={16} />
                  )}
                  {acceptMode === 'create'
                    ? 'Accept and create shipment'
                    : acceptMode === 'link'
                      ? 'Accept and link shipment'
                      : 'Accept quote'}
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reject Dialog */}
        {showRejectDialog && (
          <Card className="border-red-200 dark:border-red-800">
            <div className="p-4 pb-0">
              <CardTitle>Reject Quote</CardTitle>
            </div>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="rejectReason">Reason for rejection (optional)</label>
                <TextArea
                  id="rejectReason"
                  placeholder="Enter reason for rejecting this quote..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                  Cancel
                </Button>
                <button
                  type="button"
                  className={primaryButton}
                  onClick={() => rejectQuote({ quoteId: quote.id, reason: rejectReason || undefined })}
                  disabled={isRejecting}
                >
                  {isRejecting ? <IconLoader2 size={16} className="animate-spin" /> : <IconX size={16} />}
                  Confirm rejection
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quote Summary */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="p-4 pb-0">
              <CardTitle>Quote Summary</CardTitle>
            </div>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide">
                    Forwarder
                  </Typography>
                  <Typography variant="headingSm" className="mt-1">
                    {quote.forwarderName}
                  </Typography>
                  {quote.forwarderContact && (
                    <Typography variant="bodySm" colorRole="muted">
                      {quote.forwarderContact}
                    </Typography>
                  )}
                  {quote.forwarderEmail && (
                    <Typography variant="bodySm" colorRole="muted">
                      {quote.forwarderEmail}
                    </Typography>
                  )}
                  {quote.forwarderReference && (
                    <Typography variant="bodySm" colorRole="muted">
                      Their reference {quote.forwarderReference}
                    </Typography>
                  )}
                  {quote.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={a.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-sm text-text-primary underline"
                    >
                      {a.fileName}
                    </a>
                  ))}
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide">
                    Route
                  </Typography>
                  <Typography variant="headingSm" className="mt-1">
                    {quote.originCity || quote.originCountry || 'Origin'} →{' '}
                    {quote.destinationCity || quote.destinationCountry || 'Destination'}
                  </Typography>
                  {quote.transportMode && (
                    <Typography variant="bodySm" colorRole="muted">
                      {quote.transportMode.replace('_', ' ')}
                    </Typography>
                  )}
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide">
                    Transit Time
                  </Typography>
                  <Typography variant="headingSm" className="mt-1">
                    {quote.transitDays ? `${quote.transitDays} days` : '-'}
                  </Typography>
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide">
                    Validity
                  </Typography>
                  <Typography variant="bodySm" className="mt-1">
                    {quote.validFrom && quote.validUntil
                      ? `${formatDate(quote.validFrom)} - ${formatDate(quote.validUntil)}`
                      : quote.validUntil
                        ? `Until ${formatDate(quote.validUntil)}`
                        : '-'}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <div className="p-4 pb-0">
              <CardTitle>Total Price</CardTitle>
            </div>
            <CardContent>
              <Typography variant="headingLg" className="text-text-brand">
                {formatCurrency(quote.totalPrice, quote.currency)}
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mt-2">
                {quote.lineItems.length} line items
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* Linked Shipment */}
        {quote.shipment && (
          <Card>
            <div className="p-4 pb-0">
              <CardTitle className="flex items-center gap-2">
                <Icon icon={IconShip} size="sm" colorRole="muted" />
                Linked Shipment
              </CardTitle>
            </div>
            <CardContent>
              <Link
                href={`/platform/admin/logistics/shipments/${quote.shipment.id}`}
                className="flex items-center justify-between rounded-lg border border-border-primary p-4 hover:border-border-brand transition-colors"
              >
                <div>
                  <Typography variant="bodySm" className="font-mono text-text-muted">
                    {quote.shipment.shipmentNumber}
                  </Typography>
                  <Typography variant="headingSm">
                    {quote.shipment.originCountry ?? 'Origin'} → {quote.shipment.destinationCountry ?? 'Destination'}
                  </Typography>
                </div>
                <Icon icon={IconArrowLeft} size="sm" className="rotate-180" />
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Cost Breakdown */}
        <Card>
          <div className="p-4 pb-0">
            <CardTitle>Cost Breakdown</CardTitle>
          </div>
          <CardContent>
            {quote.lineItems.length === 0 ? (
              <Typography variant="bodySm" colorRole="muted">
                No line items added to this quote.
              </Typography>
            ) : (
              <div className="space-y-6">
                {Object.entries(lineItemsByCategory).map(([category, items]) => (
                  <div key={category}>
                    <Typography variant="bodySm" className="font-medium mb-2">
                      {category}
                    </Typography>
                    <div className="rounded-lg border border-border-primary overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-surface-secondary">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">
                              Description
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-text-muted">
                              Unit Price
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-text-muted">
                              Qty
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-text-muted">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-primary">
                          {items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-2 text-sm">{item.description}</td>
                              <td className="px-4 py-2 text-sm text-right">
                                {item.unitPrice
                                  ? formatCurrency(item.unitPrice, item.currency || quote.currency)
                                  : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                              <td className="px-4 py-2 text-sm text-right font-medium">
                                {formatCurrency(item.total, item.currency || quote.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-surface-secondary">
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-sm font-medium text-right">
                              Subtotal:
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-right">
                              {formatCurrency(
                                items.reduce((sum, item) => sum + item.total, 0),
                                quote.currency,
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-end gap-4 border-t border-border-primary pt-4">
                  <Typography variant="headingSm">Grand Total:</Typography>
                  <Typography variant="headingMd" className="text-text-brand">
                    {formatCurrency(quote.totalPrice, quote.currency)}
                  </Typography>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {(quote.notes || quote.internalNotes) && (
          <Card>
            <div className="p-4 pb-0">
              <CardTitle>Notes</CardTitle>
            </div>
            <CardContent className="space-y-4">
              {quote.notes && (
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide mb-1">
                    General Notes
                  </Typography>
                  <Typography variant="bodySm" className="whitespace-pre-wrap">
                    {quote.notes}
                  </Typography>
                </div>
              )}
              {quote.internalNotes && (
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide mb-1">
                    Internal Notes
                  </Typography>
                  <Typography variant="bodySm" className="whitespace-pre-wrap">
                    {quote.internalNotes}
                  </Typography>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Acceptance/Rejection Info */}
        {quote.status === 'accepted' && quote.acceptedAt && (
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <IconCheck className="h-5 w-5" />
                <Typography variant="bodySm">
                  Accepted on {formatDate(quote.acceptedAt)}
                </Typography>
              </div>
            </CardContent>
          </Card>
        )}

        {quote.status === 'rejected' && quote.rejectedAt && (
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <IconX className="h-5 w-5" />
                <Typography variant="bodySm">
                  Rejected on {formatDate(quote.rejectedAt)}
                  {quote.rejectionReason && ` - ${quote.rejectionReason}`}
                </Typography>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default QuoteDetailPage;
