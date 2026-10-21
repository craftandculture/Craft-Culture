'use client';

import { IconArrowLeft, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import pendingQuoteDraft from '@/app/_logistics/utils/pendingQuoteDraft';
import type { PendingQuoteDraft } from '@/app/_logistics/utils/pendingQuoteDraft';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import TextArea from '@/app/_ui/components/TextArea/TextArea';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { logisticsTransportMode } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type TransportMode = (typeof logisticsTransportMode.enumValues)[number];

interface LineItem {
  category: string;
  description: string;
  unitPrice: number | null;
  quantity: number;
  total: number;
  currency: string | null;
}

const transportModeOptions: { value: TransportMode; label: string }[] = [
  { value: 'sea_fcl', label: 'Sea (FCL)' },
  { value: 'sea_lcl', label: 'Sea (LCL)' },
  { value: 'air', label: 'Air' },
  { value: 'road', label: 'Road' },
];

const categoryOptions = [
  'Freight',
  'Origin Handling',
  'Destination Handling',
  'Documentation',
  'Insurance',
  'Customs',
  'Local Delivery',
  'Other',
];

/**
 * Create new freight quote page
 *
 * Opened from a quote request (?requestId=) it answers that request: the route,
 * transport mode and cargo are copied from it and the quote is linked to it.
 * Opened from a shipment (?shipmentId=) it is linked to that shipment. Opened
 * with ?draft=1 from a request's drop zone, it starts filled in with the quote
 * read from the forwarder's document, which is kept with the quote.
 */
const NewQuotePage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useTRPC();
  const queryClient = useQueryClient();
  const shipmentId = searchParams.get('shipmentId') || undefined;
  const requestId = searchParams.get('requestId') || undefined;
  const backHref = requestId
    ? `/platform/admin/logistics/requests/${requestId}`
    : '/platform/admin/logistics/quotes';

  // Form state
  const [forwarderName, setForwarderName] = useState('');
  const [forwarderContact, setForwarderContact] = useState('');
  const [forwarderEmail, setForwarderEmail] = useState('');
  const [forwarderReference, setForwarderReference] = useState('');
  const [forwarderId, setForwarderId] = useState<string | undefined>(undefined);
  const [originCountry, setOriginCountry] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode | ''>('');
  const [transitDays, setTransitDays] = useState<number | ''>('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      category: 'Freight',
      description: '',
      unitPrice: null,
      quantity: 1,
      total: 0,
      currency: null,
    },
  ]);

  // If linked to shipment, fetch shipment details
  const { data: shipment } = useQuery({
    ...api.logistics.admin.getOne.queryOptions({ id: shipmentId! }),
    enabled: !!shipmentId,
  });

  // If answering a quote request, fetch it to copy its route and cargo
  const { data: request } = useQuery({
    ...api.logistics.admin.requests.getOne.queryOptions({
      requestId: requestId!,
    }),
    enabled: !!requestId,
  });

  // A quote read from the forwarder's document fills the form once; the person checks it
  const [read, setRead] = useState<PendingQuoteDraft | null>(null);
  useEffect(() => {
    if (searchParams.get('draft') !== '1') return;
    const taken = pendingQuoteDraft();
    if (!taken || taken.requestId !== requestId) return;
    const d = taken.draft;
    setRead(taken);
    setForwarderId(d.forwarderId ?? undefined);
    setForwarderName(d.matchedForwarderName ?? d.forwarderName);
    setForwarderContact(d.contactName ?? '');
    setForwarderEmail(d.forwarderEmail ?? '');
    setForwarderReference(d.forwarderReference ?? '');
    setCurrency(d.currency || 'USD');
    setTransitDays(d.transitDays ?? '');
    setValidUntil(d.validUntil ?? '');
    if (d.transportMode) setTransportMode(d.transportMode);
    setNotes(d.notes ?? '');
    setLineItems(
      d.lineItems.length
        ? d.lineItems.map((l) => ({
            category: l.category,
            description: l.description,
            unitPrice: null,
            quantity: 1,
            total: l.total,
            currency: null,
          }))
        : [
            {
              category: 'Freight',
              description: 'Freight',
              unitPrice: null,
              quantity: 1,
              total: d.totalPrice,
              currency: null,
            },
          ],
    );
  }, [requestId, searchParams]);

  const { mutateAsync: uploadAttachment } = useMutation(
    api.logistics.admin.quotes.uploadAttachment.mutationOptions(),
  );

  // Copy the request's route once it loads, without overwriting anything typed
  const prefilledFrom = useRef<string | null>(null);
  useEffect(() => {
    if (!request || prefilledFrom.current === request.id) return;
    prefilledFrom.current = request.id;
    setOriginCountry((v) => v || request.originCountry || '');
    setOriginCity((v) => v || request.originCity || '');
    setDestinationCountry((v) => v || request.destinationCountry || '');
    setDestinationCity((v) => v || request.destinationCity || '');
    setTransportMode((v) => v || request.transportMode || '');
  }, [request]);

  // Create mutation
  const { mutate: createQuote, isPending } = useMutation({
    ...api.logistics.admin.quotes.create.mutationOptions(),
    onSuccess: async (result) => {
      toast.success('Quote saved');
      if (read?.file) {
        await uploadAttachment({
          quoteId: result.id,
          fileName: read.file.fileName,
          fileData: read.file.base64,
          mimeType: read.file.mimeType,
        }).catch(() =>
          toast.error(
            'The quote was saved, but its document could not be attached',
          ),
        );
      }
      void queryClient.invalidateQueries({
        queryKey: [['logistics', 'admin', 'quotes', 'getMany']],
      });
      void queryClient.invalidateQueries({
        queryKey: [['logistics', 'admin', 'requests']],
      });
      void queryClient.invalidateQueries({
        queryKey: [['logistics', 'admin', 'getDashboardMetrics']],
      });
      // Back to the request, where the quote now ranks against the others
      router.push(
        requestId ? backHref : `/platform/admin/logistics/quotes/${result.id}`,
      );
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create quote');
    },
  });

  const totalPrice = lineItems.reduce(
    (sum, item) => sum + (item.total || 0),
    0,
  );

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        category: 'Freight',
        description: '',
        unitPrice: null,
        quantity: 1,
        total: 0,
        currency: null,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (
    index: number,
    field: keyof LineItem,
    value: string | number | null,
  ) => {
    const current = lineItems[index];
    if (!current) return;

    const updated: LineItem = { ...current, [field]: value };

    // Auto-calculate total if unit price and quantity are set
    if (field === 'unitPrice' || field === 'quantity') {
      if (updated.unitPrice !== null && updated.quantity) {
        updated.total = updated.unitPrice * updated.quantity;
      }
    }

    setLineItems(lineItems.map((item, i) => (i === index ? updated : item)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!forwarderName) {
      toast.error('Forwarder name is required');
      return;
    }

    if (totalPrice <= 0) {
      toast.error('Total price must be greater than 0');
      return;
    }

    createQuote({
      forwarderName,
      forwarderContact: forwarderContact || undefined,
      forwarderEmail: forwarderEmail || undefined,
      forwarderId:
        forwarderId &&
        forwarderName === (read?.draft.matchedForwarderName ?? '')
          ? forwarderId
          : undefined,
      forwarderReference: forwarderReference || undefined,
      shipmentId,
      requestId,
      originCountry: originCountry || undefined,
      originCity: originCity || undefined,
      destinationCountry: destinationCountry || undefined,
      destinationCity: destinationCity || undefined,
      transportMode: transportMode || undefined,
      totalPrice,
      currency,
      transitDays: transitDays ? Number(transitDays) : undefined,
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      notes: notes || undefined,
      internalNotes: internalNotes || undefined,
      lineItems: lineItems
        .filter((item) => item.description && item.total > 0)
        .map((item) => ({
          category: item.category,
          description: item.description,
          unitPrice: item.unitPrice ?? undefined,
          quantity: item.quantity,
          total: item.total,
          currency: item.currency ?? undefined,
        })),
    });
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={backHref}>
              <Icon icon={IconArrowLeft} size="sm" />
            </Link>
          </Button>
          <div>
            <Typography variant="headingLg">New Freight Quote</Typography>
            {shipment && (
              <Typography variant="bodySm" colorRole="muted">
                Linked to shipment: {shipment.shipmentNumber}
              </Typography>
            )}
            {request && (
              <Typography variant="bodySm" colorRole="muted">
                Answering request {request.requestNumber}
              </Typography>
            )}
          </div>
        </div>

        {/* The request being answered, so the cargo is in view while pricing */}
        {request && (
          <Card>
            <div className="p-4 pb-0">
              <CardTitle>Request {request.requestNumber}</CardTitle>
            </div>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-text-muted text-xs">Route</dt>
                  <dd>
                    {request.originCity || request.originCountry} →{' '}
                    {request.destinationCity || request.destinationCountry}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted text-xs">Cargo</dt>
                  <dd className="capitalize">
                    {[
                      request.productType,
                      request.totalCases ? `${request.totalCases} cases` : null,
                      request.totalPallets
                        ? `${request.totalPallets} pallets`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted text-xs">Weight and volume</dt>
                  <dd>
                    {[
                      request.totalWeightKg
                        ? `${request.totalWeightKg.toFixed(0)} kg`
                        : null,
                      request.totalVolumeM3
                        ? `${request.totalVolumeM3.toFixed(2)} m³`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted text-xs">Requirements</dt>
                  <dd>
                    {[
                      request.requiresThermalLiner ? 'Thermal liner' : null,
                      request.requiresTracker ? 'Tracker' : null,
                      request.requiresInsurance ? 'Insurance' : null,
                      request.temperatureControlled
                        ? 'Temperature controlled'
                        : null,
                    ]
                      .filter(Boolean)
                      .join(', ') || 'None'}
                  </dd>
                </div>
              </dl>
              {request.productDescription && (
                <p className="text-text-muted mt-3 text-sm">
                  {request.productDescription}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {read && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              read.draft.linesMatchTotal
                ? 'border-border-muted bg-surface-secondary/40 text-text-primary'
                : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
            }`}
          >
            <p className="font-medium">
              Read from {read.file ? read.file.fileName : 'the pasted email'}.
              Check every figure against the document before saving.
            </p>
            <p className="mt-1">
              Currency <strong>{read.draft.currency}</strong> · document total{' '}
              <strong>
                {read.draft.totalPrice.toLocaleString('en-GB', {
                  minimumFractionDigits: 2,
                })}
              </strong>
              {read.draft.lineItems.length > 0 && (
                <>
                  {' '}
                  · lines add up to{' '}
                  <strong>
                    {read.draft.lineSum.toLocaleString('en-GB', {
                      minimumFractionDigits: 2,
                    })}
                  </strong>
                  {!read.draft.linesMatchTotal &&
                    ' — they do not match; find the missing or misread line'}
                </>
              )}
              {read.draft.matchedForwarderName
                ? ` · matched to ${read.draft.matchedForwarderName} on file`
                : ' · a new forwarder; it will be added when you save'}
            </p>
          </div>
        )}

        {/* Forwarder Details */}
        <Card>
          <div className="p-4 pb-0">
            <CardTitle>Forwarder Details</CardTitle>
          </div>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="forwarderName">
                  Forwarder Name *
                </label>
                <Input
                  id="forwarderName"
                  placeholder="e.g. DHL, Kuehne+Nagel"
                  value={forwarderName}
                  onChange={(e) => setForwarderName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="forwarderContact"
                >
                  Contact Person
                </label>
                <Input
                  id="forwarderContact"
                  placeholder="Contact name"
                  value={forwarderContact}
                  onChange={(e) => setForwarderContact(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="forwarderEmail">
                  Email
                </label>
                <Input
                  id="forwarderEmail"
                  type="email"
                  placeholder="email@forwarder.com"
                  value={forwarderEmail}
                  onChange={(e) => setForwarderEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="forwarderReference"
                >
                  Their quote reference
                </label>
                <Input
                  id="forwarderReference"
                  placeholder="As printed on their quote"
                  value={forwarderReference}
                  onChange={(e) => setForwarderReference(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Route & Transport */}
        <Card>
          <div className="p-4 pb-0">
            <CardTitle>Route & Transport</CardTitle>
          </div>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4">
                <Typography variant="bodySm" className="font-medium">
                  Origin
                </Typography>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="originCountry"
                    >
                      Country
                    </label>
                    <Input
                      id="originCountry"
                      placeholder="e.g. France"
                      value={originCountry}
                      onChange={(e) => setOriginCountry(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="originCity">
                      City
                    </label>
                    <Input
                      id="originCity"
                      placeholder="e.g. Bordeaux"
                      value={originCity}
                      onChange={(e) => setOriginCity(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <Typography variant="bodySm" className="font-medium">
                  Destination
                </Typography>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="destinationCountry"
                    >
                      Country
                    </label>
                    <Input
                      id="destinationCountry"
                      placeholder="e.g. UAE"
                      value={destinationCountry}
                      onChange={(e) => setDestinationCountry(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="destinationCity"
                    >
                      City
                    </label>
                    <Input
                      id="destinationCity"
                      placeholder="e.g. Dubai"
                      value={destinationCity}
                      onChange={(e) => setDestinationCity(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="transportMode">
                  Transport Mode
                </label>
                <Select
                  value={transportMode}
                  onValueChange={(v) =>
                    v && setTransportMode(v as TransportMode)
                  }
                >
                  <SelectTrigger id="transportMode">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {transportModeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="transitDays">
                  Transit Days
                </label>
                <Input
                  id="transitDays"
                  type="number"
                  min="1"
                  placeholder="e.g. 21"
                  value={transitDays}
                  onChange={(e) =>
                    setTransitDays(
                      e.target.value ? parseInt(e.target.value) : '',
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="currency">
                  Currency
                </label>
                <Select
                  value={currency}
                  // Radix reports '' when the value is set from a read quote; keep the currency held
                  onValueChange={(v) => v && setCurrency(v)}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="AED">AED</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    {!['USD', 'EUR', 'AED', 'GBP'].includes(currency) && (
                      <SelectItem value={currency}>{currency}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Validity Period */}
        <Card>
          <div className="p-4 pb-0">
            <CardTitle>Validity Period</CardTitle>
          </div>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="validFrom">
                  Valid From
                </label>
                <Input
                  id="validFrom"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="validUntil">
                  Valid Until
                </label>
                <Input
                  id="validUntil"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle>Cost Breakdown</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
              >
                <ButtonContent iconLeft={IconPlus}>Add Item</ButtonContent>
              </Button>
            </div>
          </div>
          <CardContent className="space-y-4">
            {lineItems.map((item, index) => (
              <div
                key={index}
                className="border-border-primary grid gap-4 rounded-lg border p-4 sm:grid-cols-12"
              >
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={item.category}
                    onValueChange={(v) =>
                      v && updateLineItem(index, 'category', v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-4">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    placeholder="Description of charge"
                    value={item.description}
                    onChange={(e) =>
                      updateLineItem(index, 'description', e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Unit Price</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={item.unitPrice ?? ''}
                    onChange={(e) =>
                      updateLineItem(
                        index,
                        'unitPrice',
                        e.target.value ? parseFloat(e.target.value) : null,
                      )
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <label className="text-sm font-medium">Qty</label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLineItem(
                        index,
                        'quantity',
                        parseInt(e.target.value) || 1,
                      )
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Total</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={item.total || ''}
                    onChange={(e) =>
                      updateLineItem(
                        index,
                        'total',
                        parseFloat(e.target.value) || 0,
                      )
                    }
                  />
                </div>
                <div className="flex items-end sm:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLineItem(index)}
                    disabled={lineItems.length === 1}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Icon icon={IconTrash} size="sm" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="border-border-primary flex items-center justify-end gap-4 border-t pt-4">
              <Typography variant="bodySm" colorRole="muted">
                Total Quote Price:
              </Typography>
              <Typography variant="headingMd">
                {/^[A-Z]{3}$/.test(currency)
                  ? new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency,
                    }).format(totalPrice)
                  : totalPrice.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
              </Typography>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <div className="p-4 pb-0">
            <CardTitle>Notes</CardTitle>
          </div>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="notes">
                Quote Notes (visible to all)
              </label>
              <TextArea
                id="notes"
                placeholder="General notes about this quote..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="internalNotes">
                Internal Notes (admin only)
              </label>
              <TextArea
                id="internalNotes"
                placeholder="Internal notes for reference..."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button variant="outline" asChild>
            <Link href={backHref}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <ButtonContent isLoading>Creating...</ButtonContent>
            ) : (
              <ButtonContent iconLeft={IconPlus}>Create Quote</ButtonContent>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NewQuotePage;
