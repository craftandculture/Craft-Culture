'use client';

import {
  IconArrowLeft,
  IconLoader2,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardHeader from '@/app/_ui/components/Card/CardHeader';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Label from '@/app/_ui/components/Label/Label';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Textarea from '@/app/_ui/components/Textarea/Textarea';
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
 */
const NewQuotePage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useTRPC();
  const queryClient = useQueryClient();
  const shipmentId = searchParams.get('shipmentId') || undefined;

  // Form state
  const [forwarderName, setForwarderName] = useState('');
  const [forwarderContact, setForwarderContact] = useState('');
  const [forwarderEmail, setForwarderEmail] = useState('');
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
    { category: 'Freight', description: '', unitPrice: null, quantity: 1, total: 0, currency: null },
  ]);

  // If linked to shipment, fetch shipment details
  const { data: shipment } = useQuery({
    ...api.logistics.admin.getOne.queryOptions({ id: shipmentId! }),
    enabled: !!shipmentId,
  });

  // Create mutation
  const { mutate: createQuote, isPending } = useMutation({
    ...api.logistics.admin.quotes.create.mutationOptions(),
    onSuccess: (result) => {
      toast.success('Quote created successfully');
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'quotes', 'getMany']] });
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getDashboardMetrics']] });
      router.push(`/platform/admin/logistics/quotes/${result.id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create quote');
    },
  });

  const totalPrice = lineItems.reduce((sum, item) => sum + (item.total || 0), 0);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { category: 'Freight', description: '', unitPrice: null, quantity: 1, total: 0, currency: null },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number | null) => {
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-calculate total if unit price and quantity are set
    if (field === 'unitPrice' || field === 'quantity') {
      const unitPrice = field === 'unitPrice' ? (value as number) : newItems[index].unitPrice;
      const quantity = field === 'quantity' ? (value as number) : newItems[index].quantity;
      if (unitPrice !== null && quantity) {
        newItems[index].total = unitPrice * quantity;
      }
    }

    setLineItems(newItems);
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
      shipmentId,
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
            <Link href="/platform/admin/logistics/quotes">
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
          </div>
        </div>

        {/* Forwarder Details */}
        <Card>
          <CardHeader>
            <CardTitle>Forwarder Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="forwarderName">Forwarder Name *</Label>
                <Input
                  id="forwarderName"
                  placeholder="e.g. DHL, Kuehne+Nagel"
                  value={forwarderName}
                  onChange={(e) => setForwarderName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forwarderContact">Contact Person</Label>
                <Input
                  id="forwarderContact"
                  placeholder="Contact name"
                  value={forwarderContact}
                  onChange={(e) => setForwarderContact(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forwarderEmail">Email</Label>
                <Input
                  id="forwarderEmail"
                  type="email"
                  placeholder="email@forwarder.com"
                  value={forwarderEmail}
                  onChange={(e) => setForwarderEmail(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Route & Transport */}
        <Card>
          <CardHeader>
            <CardTitle>Route & Transport</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4">
                <Typography variant="bodySm" className="font-medium">
                  Origin
                </Typography>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="originCountry">Country</Label>
                    <Input
                      id="originCountry"
                      placeholder="e.g. France"
                      value={originCountry}
                      onChange={(e) => setOriginCountry(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="originCity">City</Label>
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
                    <Label htmlFor="destinationCountry">Country</Label>
                    <Input
                      id="destinationCountry"
                      placeholder="e.g. UAE"
                      value={destinationCountry}
                      onChange={(e) => setDestinationCountry(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destinationCity">City</Label>
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
                <Label htmlFor="transportMode">Transport Mode</Label>
                <Select
                  value={transportMode}
                  onValueChange={(v) => setTransportMode(v as TransportMode)}
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
                <Label htmlFor="transitDays">Transit Days</Label>
                <Input
                  id="transitDays"
                  type="number"
                  min="1"
                  placeholder="e.g. 21"
                  value={transitDays}
                  onChange={(e) => setTransitDays(e.target.value ? parseInt(e.target.value) : '')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="AED">AED</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Validity Period */}
        <Card>
          <CardHeader>
            <CardTitle>Validity Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="validFrom">Valid From</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validUntil">Valid Until</Label>
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
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Cost Breakdown</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <ButtonContent iconLeft={IconPlus}>Add Item</ButtonContent>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {lineItems.map((item, index) => (
              <div
                key={index}
                className="grid gap-4 rounded-lg border border-border-primary p-4 sm:grid-cols-12"
              >
                <div className="space-y-2 sm:col-span-2">
                  <Label>Category</Label>
                  <Select
                    value={item.category}
                    onValueChange={(v) => updateLineItem(index, 'category', v)}
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
                  <Label>Description</Label>
                  <Input
                    placeholder="Description of charge"
                    value={item.description}
                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={item.unitPrice ?? ''}
                    onChange={(e) =>
                      updateLineItem(index, 'unitPrice', e.target.value ? parseFloat(e.target.value) : null)
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label>Qty</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Total</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={item.total || ''}
                    onChange={(e) => updateLineItem(index, 'total', parseFloat(e.target.value) || 0)}
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
            <div className="flex items-center justify-end gap-4 border-t border-border-primary pt-4">
              <Typography variant="bodySm" colorRole="muted">
                Total Quote Price:
              </Typography>
              <Typography variant="headingMd">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency,
                }).format(totalPrice)}
              </Typography>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Quote Notes (visible to all)</Label>
              <Textarea
                id="notes"
                placeholder="General notes about this quote..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internalNotes">Internal Notes (admin only)</Label>
              <Textarea
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
            <Link href="/platform/admin/logistics/quotes">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <ButtonContent iconLeft={IconLoader2} iconLeftClassName="animate-spin">
                Creating...
              </ButtonContent>
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
