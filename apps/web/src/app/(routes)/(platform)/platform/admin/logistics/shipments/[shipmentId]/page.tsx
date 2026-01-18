'use client';

import {
  IconArrowLeft,
  IconCalculator,
  IconFileText,
  IconLoader2,
  IconPackage,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import ActivityLog from '@/app/_logistics/components/ActivityLog';
import LogisticsDocumentUpload from '@/app/_logistics/components/DocumentUpload';
import ShipmentStatusBadge from '@/app/_logistics/components/ShipmentStatusBadge';
import ShipmentStatusStepper from '@/app/_logistics/components/ShipmentStatusStepper';
import ShipmentTracker from '@/app/_logistics/components/ShipmentTracker';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { LogisticsShipment } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

type ShipmentStatus = LogisticsShipment['status'];

const statusOptions: { value: ShipmentStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'booked', label: 'Booked' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'arrived_port', label: 'Arrived Port' },
  { value: 'customs_clearance', label: 'Customs Clearance' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'at_warehouse', label: 'At Warehouse' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

type TabType = 'overview' | 'tracking' | 'items' | 'documents' | 'costs';

/**
 * Shipment detail page with tabs
 */
const ShipmentDetailPage = () => {
  const params = useParams();
  const shipmentId = params.shipmentId as string;
  const api = useTRPC();
  const _queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({
    productName: '',
    cases: '',
    bottlesPerCase: '12',
    productCostPerBottle: '',
  });

  const { data: shipment, isLoading, isError, error, refetch } = useQuery({
    ...api.logistics.admin.getOne.queryOptions({ id: shipmentId }),
  });

  const { mutate: updateStatus, isPending: isUpdatingStatus } = useMutation(
    api.logistics.admin.updateStatus.mutationOptions({
      onSuccess: () => {
        toast.success('Status updated');
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: addItem, isPending: isAddingItemPending } = useMutation(
    api.logistics.admin.addItem.mutationOptions({
      onSuccess: () => {
        toast.success('Item added');
        setIsAddingItem(false);
        setNewItem({ productName: '', cases: '', bottlesPerCase: '12', productCostPerBottle: '' });
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: removeItem } = useMutation(
    api.logistics.admin.removeItem.mutationOptions({
      onSuccess: () => {
        toast.success('Item removed');
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: calculateLandedCost, isPending: isCalculating } = useMutation(
    api.logistics.admin.calculateLandedCost.mutationOptions({
      onSuccess: (result) => {
        toast.success(`Landed cost calculated: ${formatPrice(result.landedCostPerBottle, 'USD')}/bottle`);
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleStatusChange = (status: ShipmentStatus) => {
    updateStatus({ id: shipmentId, status });
  };

  const handleAddItem = () => {
    if (!newItem.productName || !newItem.cases) {
      toast.error('Product name and cases are required');
      return;
    }
    addItem({
      shipmentId,
      productName: newItem.productName,
      cases: parseInt(newItem.cases, 10),
      bottlesPerCase: parseInt(newItem.bottlesPerCase, 10) || 12,
      productCostPerBottle: newItem.productCostPerBottle ? parseFloat(newItem.productCostPerBottle) : undefined,
    });
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Icon icon={IconLoader2} className="animate-spin" size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Typography variant="headingSm" className="text-text-danger mb-2">
              Error loading shipment
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              {error?.message || 'An unexpected error occurred'}
            </Typography>
            <div className="mt-4">
              <Link href="/platform/admin/logistics">
                <Button variant="outline" size="sm">
                  <Icon icon={IconArrowLeft} size="sm" className="mr-2" />
                  Back to list
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Typography variant="headingSm">Shipment not found</Typography>
            <Typography variant="bodySm" colorRole="muted" className="mt-2">
              The shipment with ID {shipmentId} does not exist.
            </Typography>
            <div className="mt-4">
              <Link href="/platform/admin/logistics">
                <Button variant="outline" size="sm">
                  <Icon icon={IconArrowLeft} size="sm" className="mr-2" />
                  Back to list
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: typeof IconPackage }[] = [
    { id: 'overview', label: 'Overview', icon: IconFileText },
    { id: 'tracking', label: 'Tracking', icon: IconRefresh },
    { id: 'items', label: `Items (${shipment.items?.length ?? 0})`, icon: IconPackage },
    { id: 'documents', label: `Documents (${shipment.documents?.length ?? 0})`, icon: IconUpload },
    { id: 'costs', label: 'Costs', icon: IconCalculator },
  ];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/platform/admin/logistics">
              <Button variant="ghost" size="sm">
                <Icon icon={IconArrowLeft} size="sm" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <Typography variant="headingLg">{shipment.shipmentNumber}</Typography>
                <ShipmentStatusBadge status={shipment.status} />
              </div>
              <Typography variant="bodyMd" colorRole="muted">
                {shipment.originCity ?? shipment.originCountry ?? 'Origin'} →{' '}
                {shipment.destinationCity ?? shipment.destinationWarehouse ?? 'Destination'}
              </Typography>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              <Icon icon={IconRefresh} size="sm" />
            </Button>
            <Select value={shipment.status} onValueChange={handleStatusChange} disabled={isUpdatingStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Stepper */}
        <Card>
          <CardContent className="p-4">
            <ShipmentStatusStepper
              currentStatus={shipment.status}
              onStatusClick={handleStatusChange}
            />
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border-muted overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-border-brand text-text-brand'
                  : 'border-transparent text-text-muted hover:border-border-muted hover:text-text-primary'
              }`}
            >
              <Icon icon={tab.icon} size="sm" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Shipment Details
                </Typography>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Type</dt>
                    <dd className="capitalize">{shipment.type.replace('_', '-')}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Transport</dt>
                    <dd className="uppercase">{shipment.transportMode.replace('_', ' ')}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Carrier</dt>
                    <dd>{shipment.carrierName ?? '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Container #</dt>
                    <dd className="font-mono">{shipment.containerNumber ?? '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">BOL #</dt>
                    <dd className="font-mono">{shipment.blNumber ?? '-'}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Timeline
                </Typography>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-text-muted">ETD</dt>
                    <dd>{formatDate(shipment.etd)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">ATD</dt>
                    <dd>{formatDate(shipment.atd)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">ETA</dt>
                    <dd>{formatDate(shipment.eta)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">ATA</dt>
                    <dd>{formatDate(shipment.ata)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Delivered</dt>
                    <dd>{formatDate(shipment.deliveredAt)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Cargo Summary
                </Typography>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Total Cases
                    </Typography>
                    <Typography variant="headingMd">{shipment.totalCases ?? 0}</Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Total Bottles
                    </Typography>
                    <Typography variant="headingMd">{shipment.totalBottles ?? 0}</Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Weight (kg)
                    </Typography>
                    <Typography variant="headingMd">
                      {shipment.totalWeightKg?.toFixed(1) ?? '-'}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Landed Cost
                    </Typography>
                    <Typography variant="headingMd">
                      {shipment.totalLandedCostUsd
                        ? formatPrice(shipment.totalLandedCostUsd, 'USD')
                        : '-'}
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'tracking' && (
          <div className="space-y-6">
            <ShipmentTracker
              shipmentId={shipmentId}
              hillebrandShipmentId={shipment.hillebrandShipmentId}
              originCity={shipment.originCity}
              originCountry={shipment.originCountry}
              destinationCity={shipment.destinationCity}
              destinationWarehouse={shipment.destinationWarehouse}
              status={shipment.status}
              etd={shipment.etd}
              atd={shipment.atd}
              eta={shipment.eta}
              ata={shipment.ata}
              deliveredAt={shipment.deliveredAt}
            />

            {/* Activity Log */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Activity Log
                </Typography>
                <ActivityLog
                  activities={(shipment.activityLogs ?? []).map((log) => ({
                    id: log.id,
                    type: log.action,
                    description: log.notes ?? log.action,
                    createdAt: log.createdAt,
                    createdBy: log.user?.name ?? log.user?.email ?? null,
                    metadata: null,
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'items' && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Typography variant="headingSm">Items</Typography>
                <Button size="sm" onClick={() => setIsAddingItem(true)}>
                  <ButtonContent iconLeft={IconPlus}>Add Item</ButtonContent>
                </Button>
              </div>

              {isAddingItem && (
                <div className="mb-6 p-4 border border-border-muted rounded-lg bg-surface-muted">
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Product Name</label>
                      <Input
                        placeholder="e.g. Chateau Margaux 2018"
                        value={newItem.productName}
                        onChange={(e) => setNewItem((p) => ({ ...p, productName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Cases</label>
                      <Input
                        type="number"
                        placeholder="20"
                        value={newItem.cases}
                        onChange={(e) => setNewItem((p) => ({ ...p, cases: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Bottles/Case</label>
                      <Input
                        type="number"
                        value={newItem.bottlesPerCase}
                        onChange={(e) => setNewItem((p) => ({ ...p, bottlesPerCase: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Cost/Bottle (USD)</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="12.00"
                        value={newItem.productCostPerBottle}
                        onChange={(e) => setNewItem((p) => ({ ...p, productCostPerBottle: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" onClick={handleAddItem} disabled={isAddingItemPending}>
                      <ButtonContent>{isAddingItemPending ? 'Adding...' : 'Add'}</ButtonContent>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsAddingItem(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {!shipment.items?.length ? (
                <Typography variant="bodyMd" colorRole="muted" className="text-center py-8">
                  No items added yet
                </Typography>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-muted text-left text-xs uppercase text-text-muted">
                        <th className="pb-3 pr-4">Product</th>
                        <th className="pb-3 pr-4 text-right">Cases</th>
                        <th className="pb-3 pr-4 text-right">Bottles</th>
                        <th className="pb-3 pr-4 text-right">Cost/Btl</th>
                        <th className="pb-3 pr-4 text-right">Landed/Btl</th>
                        <th className="pb-3 pr-4 text-right">Margin</th>
                        <th className="pb-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-muted">
                      {shipment.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 pr-4">
                            <Typography variant="bodySm" className="font-medium">
                              {item.productName}
                            </Typography>
                            {item.producer && (
                              <Typography variant="bodyXs" colorRole="muted">
                                {item.producer}
                              </Typography>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right">{item.cases}</td>
                          <td className="py-3 pr-4 text-right">{item.totalBottles ?? '-'}</td>
                          <td className="py-3 pr-4 text-right">
                            {item.productCostPerBottle ? `$${item.productCostPerBottle.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {item.landedCostPerBottle ? `$${item.landedCostPerBottle.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {item.marginPercent !== null && item.marginPercent !== undefined ? (
                              <span className={item.marginPercent >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {item.marginPercent.toFixed(0)}%
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3">
                            <button
                              onClick={() => removeItem({ itemId: item.id })}
                              className="p-1 rounded hover:bg-fill-danger/10 text-text-muted hover:text-text-danger"
                            >
                              <Icon icon={IconTrash} size="sm" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'documents' && (
          <Card>
            <CardContent className="p-6">
              <Typography variant="headingSm" className="mb-4">
                Documents
              </Typography>
              <LogisticsDocumentUpload
                shipmentId={shipmentId}
                documents={shipment.documents ?? []}
                onUploadComplete={() => void refetch()}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'costs' && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Typography variant="headingSm">Cost Breakdown</Typography>
                  <Button
                    size="sm"
                    onClick={() => calculateLandedCost({ shipmentId })}
                    disabled={isCalculating || !shipment.items?.length}
                  >
                    <ButtonContent iconLeft={isCalculating ? IconLoader2 : IconCalculator}>
                      {isCalculating ? 'Calculating...' : 'Calculate Landed Cost'}
                    </ButtonContent>
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Freight</dt>
                      <dd>{shipment.freightCostUsd ? formatPrice(shipment.freightCostUsd, 'USD') : '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Insurance</dt>
                      <dd>{shipment.insuranceCostUsd ? formatPrice(shipment.insuranceCostUsd, 'USD') : '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Origin Handling</dt>
                      <dd>{shipment.originHandlingUsd ? formatPrice(shipment.originHandlingUsd, 'USD') : '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Destination Handling</dt>
                      <dd>{shipment.destinationHandlingUsd ? formatPrice(shipment.destinationHandlingUsd, 'USD') : '-'}</dd>
                    </div>
                  </dl>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Customs Clearance</dt>
                      <dd>{shipment.customsClearanceUsd ? formatPrice(shipment.customsClearanceUsd, 'USD') : '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Gov Fees</dt>
                      <dd>{shipment.govFeesUsd ? formatPrice(shipment.govFeesUsd, 'USD') : '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Delivery</dt>
                      <dd>{shipment.deliveryCostUsd ? formatPrice(shipment.deliveryCostUsd, 'USD') : '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Other</dt>
                      <dd>{shipment.otherCostsUsd ? formatPrice(shipment.otherCostsUsd, 'USD') : '-'}</dd>
                    </div>
                  </dl>
                </div>
                <div className="mt-6 pt-4 border-t border-border-muted">
                  <div className="flex justify-between items-center">
                    <Typography variant="headingSm">Total Landed Cost</Typography>
                    <Typography variant="headingMd">
                      {shipment.totalLandedCostUsd ? formatPrice(shipment.totalLandedCostUsd, 'USD') : '-'}
                    </Typography>
                  </div>
                  {shipment.totalBottles && shipment.totalLandedCostUsd ? (
                    <div className="flex justify-between items-center mt-2">
                      <Typography variant="bodySm" colorRole="muted">
                        Per Bottle ({shipment.totalBottles} bottles)
                      </Typography>
                      <Typography variant="headingSm" className="text-text-brand">
                        {formatPrice(shipment.totalLandedCostUsd / shipment.totalBottles, 'USD')}
                      </Typography>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShipmentDetailPage;
