'use client';

import {
  IconArrowLeft,
  IconPlus,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import normaliseCountry from '@/app/_logistics/utils/normaliseCountry';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Checkbox from '@/app/_ui/components/Checkbox/Checkbox';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import TextArea from '@/app/_ui/components/TextArea/TextArea';
import Typography from '@/app/_ui/components/Typography/Typography';
import type {
  logisticsProductType,
  logisticsQuoteRequestPriority,
  logisticsTransportMode,
} from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type TransportMode = (typeof logisticsTransportMode.enumValues)[number];
type ProductType = (typeof logisticsProductType.enumValues)[number];
type Priority = (typeof logisticsQuoteRequestPriority.enumValues)[number];

const transportModeOptions: { value: TransportMode; label: string }[] = [
  { value: 'sea_fcl', label: 'Sea (FCL)' },
  { value: 'sea_lcl', label: 'Sea (LCL)' },
  { value: 'air', label: 'Air' },
  { value: 'road', label: 'Road' },
];

const productTypeOptions: { value: ProductType; label: string }[] = [
  { value: 'wine', label: 'Wine' },
  { value: 'spirits', label: 'Spirits' },
  { value: 'beer', label: 'Beer' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'other', label: 'Other' },
];

const priorityOptions: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

/** The date three working days ahead, as the default for forwarders to reply by */
const threeWorkingDaysAhead = () => {
  const d = new Date();
  for (let added = 0; added < 3; ) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
};

/**
 * Create new quote request page
 *
 * Opened from a shipment or a UK move (?sourceType=&sourceId=) it starts with
 * that route and cargo counted from its lines, bottles and 75cl equivalents
 * included, so the request is checked rather than typed.
 */
const NewQuoteRequestPage = () => {
  const router = useRouter();
  const api = useTRPC();
  const queryClient = useQueryClient();

  // Form state
  const [priority, setPriority] = useState<Priority>('normal');
  const [originCountry, setOriginCountry] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [originWarehouse, setOriginWarehouse] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationWarehouse, setDestinationWarehouse] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode | ''>('');
  const [productType, setProductType] = useState<ProductType>('wine');
  const [productDescription, setProductDescription] = useState('');
  const [totalCases, setTotalCases] = useState<number | ''>('');
  const [totalPallets, setTotalPallets] = useState<number | ''>('');
  const [totalWeightKg, setTotalWeightKg] = useState<number | ''>('');
  const [totalVolumeM3, setTotalVolumeM3] = useState<number | ''>('');
  const [totalBottles, setTotalBottles] = useState<number | ''>('');
  const [total75cl, setTotal75cl] = useState<number | ''>('');
  const [replyBy, setReplyBy] = useState(threeWorkingDaysAhead);
  const [requiresThermalLiner, setRequiresThermalLiner] = useState(false);
  const [requiresTracker, setRequiresTracker] = useState(false);
  const [requiresInsurance, setRequiresInsurance] = useState(false);
  const [temperatureControlled, setTemperatureControlled] = useState(false);
  const [minTemperature, setMinTemperature] = useState<number | ''>('');
  const [maxTemperature, setMaxTemperature] = useState<number | ''>('');
  const [targetPickupDate, setTargetPickupDate] = useState('');
  const [targetDeliveryDate, setTargetDeliveryDate] = useState('');
  const [isFlexibleDates, setIsFlexibleDates] = useState(true);
  const [notes, setNotes] = useState('');

  // Places used on past routes, offered as each route field is typed
  const { data: routeOptions } = useQuery(api.logistics.admin.requests.routeOptions.queryOptions());

  // Started from a shipment or UK move: fill the form from it once
  const searchParams = useSearchParams();
  const sourceType = searchParams.get('sourceType');
  const sourceId = searchParams.get('sourceId');
  const validSource = (sourceType === 'shipment' || sourceType === 'uk_move') && !!sourceId;
  const { data: draft } = useQuery({
    ...api.logistics.admin.requests.draftFromSource.queryOptions({
      sourceType: sourceType === 'uk_move' ? 'uk_move' : 'shipment',
      sourceId: sourceId ?? '',
    }),
    enabled: validSource,
  });
  const filledFrom = useRef<string | null>(null);
  useEffect(() => {
    if (!draft || filledFrom.current === draft.sourceId) return;
    filledFrom.current = draft.sourceId;
    setOriginCountry(draft.originCountry);
    setOriginCity(draft.originCity);
    setOriginWarehouse(draft.originWarehouse);
    setDestinationCountry(draft.destinationCountry);
    setDestinationCity(draft.destinationCity);
    setDestinationWarehouse(draft.destinationWarehouse);
    if (draft.transportMode) setTransportMode(draft.transportMode);
    setTotalCases(draft.totalCases ?? '');
    setTotalBottles(draft.totalBottles ?? '');
    setTotal75cl(draft.total75clEquivalents ?? '');
    setTotalPallets(draft.totalPallets ?? '');
    setTotalWeightKg(draft.totalWeightKg ?? '');
    setTotalVolumeM3(draft.totalVolumeM3 ?? '');
  }, [draft]);

  // Create mutation
  const { mutate: createRequest, isPending } = useMutation({
    ...api.logistics.admin.requests.create.mutationOptions(),
    onSuccess: (result) => {
      toast.success('Quote request created successfully');
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests', 'getMany']] });
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getDashboardMetrics']] });
      router.push(`/platform/admin/logistics/requests/${result.id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create quote request');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!originCountry) {
      toast.error('Origin country is required');
      return;
    }

    if (!destinationCountry) {
      toast.error('Destination country is required');
      return;
    }

    createRequest({
      priority,
      originCountry,
      originCity: originCity || undefined,
      originWarehouse: originWarehouse || undefined,
      destinationCountry,
      destinationCity: destinationCity || undefined,
      destinationWarehouse: destinationWarehouse || undefined,
      transportMode: transportMode || undefined,
      productType,
      productDescription: productDescription || undefined,
      totalCases: totalCases ? Number(totalCases) : undefined,
      totalPallets: totalPallets ? Number(totalPallets) : undefined,
      totalWeightKg: totalWeightKg ? Number(totalWeightKg) : undefined,
      totalVolumeM3: totalVolumeM3 ? Number(totalVolumeM3) : undefined,
      totalBottles: totalBottles ? Number(totalBottles) : undefined,
      // Without a 75cl figure the bottles are taken as 75cl
      total75clEquivalents: total75cl ? Number(total75cl) : totalBottles ? Number(totalBottles) : undefined,
      ...(validSource && draft ? { sourceType: draft.sourceType, sourceId: draft.sourceId } : {}),
      replyBy: replyBy ? new Date(`${replyBy}T12:00:00`) : undefined,
      requiresThermalLiner,
      requiresTracker,
      requiresInsurance,
      temperatureControlled,
      minTemperature: minTemperature ? Number(minTemperature) : undefined,
      maxTemperature: maxTemperature ? Number(maxTemperature) : undefined,
      targetPickupDate: targetPickupDate ? new Date(targetPickupDate) : undefined,
      targetDeliveryDate: targetDeliveryDate ? new Date(targetDeliveryDate) : undefined,
      isFlexibleDates,
      notes: notes || undefined,
    });
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Suggestions for the route fields; anything not listed can still be typed */}
        <datalist id="route-countries">
          {routeOptions?.countries.map((c) => <option key={c} value={c} />)}
        </datalist>
        <datalist id="route-cities">
          {routeOptions?.cities.map((c) => <option key={c} value={c} />)}
        </datalist>
        <datalist id="route-warehouses">
          {routeOptions?.warehouses.map((w) => <option key={w} value={w} />)}
        </datalist>
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/platform/admin/logistics/quotes">
              <Icon icon={IconArrowLeft} size="sm" />
            </Link>
          </Button>
          <div>
            <Typography variant="headingLg">New Quote Request</Typography>
            <Typography variant="bodySm" colorRole="muted">
              {draft
                ? `Filled in from ${draft.sourceLabel}; check the cargo, then choose forwarders on the next page`
                : 'Describe the cargo, then choose forwarders on the next page'}
            </Typography>
          </div>
        </div>

        {/* Priority */}
        <Card>
          <div className="p-4 pb-0">
            <CardTitle>Priority</CardTitle>
          </div>
          <CardContent>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="priority">Priority Level</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger id="priority" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Route Details */}
        <Card>
          <div className="p-4 pb-0">
            <CardTitle>Route Details</CardTitle>
          </div>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4">
                <Typography variant="bodySm" className="font-medium">
                  Origin
                </Typography>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="originCountry">Country *</label>
                    <Input
                      id="originCountry"
                      list="route-countries"
                      autoComplete="off"
                      onBlur={(e) => setOriginCountry(normaliseCountry(e.target.value))}
                      placeholder="e.g. France"
                      value={originCountry}
                      onChange={(e) => setOriginCountry(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="originCity">City</label>
                    <Input
                      id="originCity"
                      list="route-cities"
                      autoComplete="off"
                      placeholder="e.g. Bordeaux"
                      value={originCity}
                      onChange={(e) => setOriginCity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="originWarehouse">Warehouse / Supplier</label>
                    <Input
                      id="originWarehouse"
                      list="route-warehouses"
                      autoComplete="off"
                      placeholder="e.g. La Place Wine"
                      value={originWarehouse}
                      onChange={(e) => setOriginWarehouse(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <Typography variant="bodySm" className="font-medium">
                  Destination
                </Typography>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="destinationCountry">Country *</label>
                    <Input
                      id="destinationCountry"
                      list="route-countries"
                      autoComplete="off"
                      onBlur={(e) => setDestinationCountry(normaliseCountry(e.target.value))}
                      placeholder="e.g. United Arab Emirates"
                      value={destinationCountry}
                      onChange={(e) => setDestinationCountry(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="destinationCity">City</label>
                    <Input
                      id="destinationCity"
                      list="route-cities"
                      autoComplete="off"
                      placeholder="e.g. Dubai"
                      value={destinationCity}
                      onChange={(e) => setDestinationCity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="destinationWarehouse">Warehouse</label>
                    <Input
                      id="destinationWarehouse"
                      list="route-warehouses"
                      autoComplete="off"
                      placeholder="e.g. C&C bonded warehouse"
                      value={destinationWarehouse}
                      onChange={(e) => setDestinationWarehouse(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="transportMode">Preferred Transport Mode</label>
              <Select
                value={transportMode}
                onValueChange={(v) => setTransportMode(v as TransportMode)}
              >
                <SelectTrigger id="transportMode" className="w-48">
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
          </CardContent>
        </Card>

        {/* Cargo Details */}
        <Card>
          <div className="p-4 pb-0">
            <CardTitle>Cargo Details</CardTitle>
          </div>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="productType">Product Type</label>
                <Select
                  value={productType}
                  onValueChange={(v) => setProductType(v as ProductType)}
                >
                  <SelectTrigger id="productType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {productTypeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="productDescription">Product Description</label>
                <Input
                  id="productDescription"
                  placeholder="e.g. Premium Bordeaux wines"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="totalBottles">Bottles</label>
                <Input
                  id="totalBottles"
                  type="number"
                  min="1"
                  placeholder="e.g. 993"
                  value={totalBottles}
                  onChange={(e) => setTotalBottles(e.target.value ? parseInt(e.target.value) : '')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="total75cl">75cl equivalent</label>
                <Input
                  id="total75cl"
                  type="number"
                  min="1"
                  step="0.1"
                  placeholder="Leave empty if all 75cl"
                  value={total75cl}
                  onChange={(e) => setTotal75cl(e.target.value ? Number(e.target.value) : '')}
                />
                <p className="text-xs text-text-muted">A magnum counts 2, a half bottle 0.5. Quotes are compared on this.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="totalCases">Total Cases</label>
                <Input
                  id="totalCases"
                  type="number"
                  min="1"
                  placeholder="e.g. 100"
                  value={totalCases}
                  onChange={(e) => setTotalCases(e.target.value ? parseInt(e.target.value) : '')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="totalPallets">Total Pallets</label>
                <Input
                  id="totalPallets"
                  type="number"
                  min="1"
                  placeholder="e.g. 5"
                  value={totalPallets}
                  onChange={(e) => setTotalPallets(e.target.value ? parseInt(e.target.value) : '')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="totalWeightKg">Weight (kg)</label>
                <Input
                  id="totalWeightKg"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 1500"
                  value={totalWeightKg}
                  onChange={(e) => setTotalWeightKg(e.target.value ? parseFloat(e.target.value) : '')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="totalVolumeM3">Volume (m3)</label>
                <Input
                  id="totalVolumeM3"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 5.5"
                  value={totalVolumeM3}
                  onChange={(e) => setTotalVolumeM3(e.target.value ? parseFloat(e.target.value) : '')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Special Requirements */}
        <Card>
          <div className="p-4 pb-0">
            <CardTitle>Special Requirements</CardTitle>
          </div>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requiresThermalLiner"
                  checked={requiresThermalLiner}
                  onCheckedChange={(checked) => setRequiresThermalLiner(checked === true)}
                />
                <label className="text-sm font-medium cursor-pointer" htmlFor="requiresThermalLiner">
                  Requires Thermal Liner
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requiresTracker"
                  checked={requiresTracker}
                  onCheckedChange={(checked) => setRequiresTracker(checked === true)}
                />
                <label className="text-sm font-medium cursor-pointer" htmlFor="requiresTracker">
                  Requires Temperature Tracker
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requiresInsurance"
                  checked={requiresInsurance}
                  onCheckedChange={(checked) => setRequiresInsurance(checked === true)}
                />
                <label className="text-sm font-medium cursor-pointer" htmlFor="requiresInsurance">
                  Requires Insurance
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="temperatureControlled"
                  checked={temperatureControlled}
                  onCheckedChange={(checked) => setTemperatureControlled(checked === true)}
                />
                <label className="text-sm font-medium cursor-pointer" htmlFor="temperatureControlled">
                  Temperature Controlled
                </label>
              </div>
            </div>
            {temperatureControlled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="minTemperature">Min Temperature (C)</label>
                  <Input
                    id="minTemperature"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 12"
                    value={minTemperature}
                    onChange={(e) => setMinTemperature(e.target.value ? parseFloat(e.target.value) : '')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="maxTemperature">Max Temperature (C)</label>
                  <Input
                    id="maxTemperature"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 18"
                    value={maxTemperature}
                    onChange={(e) => setMaxTemperature(e.target.value ? parseFloat(e.target.value) : '')}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timing */}
        <Card>
          <div className="p-4 pb-0">
            <CardTitle>Timing</CardTitle>
          </div>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="targetPickupDate">Target Pickup Date</label>
                <Input
                  id="targetPickupDate"
                  type="date"
                  value={targetPickupDate}
                  onChange={(e) => setTargetPickupDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="targetDeliveryDate">Target Delivery Date</label>
                <Input
                  id="targetDeliveryDate"
                  type="date"
                  value={targetDeliveryDate}
                  onChange={(e) => setTargetDeliveryDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="replyBy">Forwarders to reply by</label>
                <Input id="replyBy" type="date" value={replyBy} onChange={(e) => setReplyBy(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isFlexibleDates"
                checked={isFlexibleDates}
                onCheckedChange={(checked) => setIsFlexibleDates(checked === true)}
              />
              <label className="text-sm font-medium cursor-pointer" htmlFor="isFlexibleDates">
                Dates are flexible
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <div className="p-4 pb-0">
            <CardTitle>Notes</CardTitle>
          </div>
          <CardContent>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="notes">Additional Notes</label>
              <TextArea
                id="notes"
                placeholder="Any additional information or requirements..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
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
              <ButtonContent isLoading>Creating...</ButtonContent>
            ) : (
              <ButtonContent iconLeft={IconPlus}>Create Request</ButtonContent>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NewQuoteRequestPage;
