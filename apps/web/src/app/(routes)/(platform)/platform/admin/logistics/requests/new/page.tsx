'use client';

import {
  IconArrowLeft,
  IconLoader2,
  IconPlus,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

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

/**
 * Create new quote request page
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
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/platform/admin/logistics/requests">
              <Icon icon={IconArrowLeft} size="sm" />
            </Link>
          </Button>
          <div>
            <Typography variant="headingLg">New Quote Request</Typography>
            <Typography variant="bodySm" colorRole="muted">
              Request a freight quote from the logistics team
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
                      placeholder="e.g. Bordeaux"
                      value={originCity}
                      onChange={(e) => setOriginCity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="originWarehouse">Warehouse / Supplier</label>
                    <Input
                      id="originWarehouse"
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
                      placeholder="e.g. UAE"
                      value={destinationCountry}
                      onChange={(e) => setDestinationCountry(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="destinationCity">City</label>
                    <Input
                      id="destinationCity"
                      placeholder="e.g. Dubai"
                      value={destinationCity}
                      onChange={(e) => setDestinationCity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="destinationWarehouse">Warehouse</label>
                    <Input
                      id="destinationWarehouse"
                      placeholder="e.g. RAK FTZ"
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
            <Link href="/platform/admin/logistics/requests">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <ButtonContent iconLeft={IconLoader2} iconLeftClassName="animate-spin">
                Creating...
              </ButtonContent>
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
