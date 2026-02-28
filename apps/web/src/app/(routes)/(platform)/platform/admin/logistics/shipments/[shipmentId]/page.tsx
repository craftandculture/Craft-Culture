'use client';

import {
  IconArrowLeft,
  IconCalculator,
  IconCheck,
  IconCloud,
  IconFileText,
  IconLoader2,
  IconPackage,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import ActivityLog from '@/app/_logistics/components/ActivityLog';
import LogisticsDocumentUpload from '@/app/_logistics/components/DocumentUpload';
import ShipmentStatusBadge from '@/app/_logistics/components/ShipmentStatusBadge';
import ShipmentStatusStepper from '@/app/_logistics/components/ShipmentStatusStepper';
import ShipmentTracker from '@/app/_logistics/components/ShipmentTracker';
import type { LwinLookupResult } from '@/app/_lwin/components/LwinLookup';
import LwinLookup from '@/app/_lwin/components/LwinLookup';
import Badge from '@/app/_ui/components/Badge/Badge';
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
import Sheet from '@/app/_ui/components/Sheet/Sheet';
import SheetContent from '@/app/_ui/components/Sheet/SheetContent';
import SheetDescription from '@/app/_ui/components/Sheet/SheetDescription';
import SheetTitle from '@/app/_ui/components/Sheet/SheetTitle';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { LogisticsShipment } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

const HS_CODES = [
  { value: '22042100', label: 'Wine' },
  { value: '22041000', label: 'Sparkling' },
  { value: '22084000', label: 'Rum' },
  { value: '22083000', label: 'Whisky' },
  { value: '22030000', label: 'Beer' },
  { value: '22082000', label: 'Brandy' },
  { value: '22089090', label: 'Tequila/Spirit' },
  { value: '22085000', label: 'Gin' },
  { value: '22087000', label: 'Liquor' },
  { value: '22086000', label: 'Vodka' },
  { value: '22060000', label: 'Cider' },
];

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
  const router = useRouter();
  const _queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({
    productName: '',
    cases: '',
    bottlesPerCase: '12',
    bottleSizeMl: '750',
    productCostPerBottle: '',
  });
  const [sheetItemId, setSheetItemId] = useState<string | null>(null);
  const [editingPackItemId, setEditingPackItemId] = useState<string | null>(null);
  const [editPack, setEditPack] = useState({ bottlesPerCase: '', bottleSizeMl: '' });
  const [sheetForm, setSheetForm] = useState({
    productName: '', producer: '', vintage: '', region: '',
    countryOfOrigin: '', hsCode: '', cases: '', bottlesPerCase: '',
    bottleSizeMl: '', productCostPerBottle: '',
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

  const { mutate: updateShipment, isPending: isUpdatingShipment } = useMutation(
    api.logistics.admin.update.mutationOptions({
      onSuccess: () => {
        toast.success('Shipment updated');
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { data: partners } = useQuery({
    ...api.partners.getMany.queryOptions({ limit: 100 }),
  });

  const { mutate: addItem, isPending: isAddingItemPending } = useMutation(
    api.logistics.admin.addItem.mutationOptions({
      onSuccess: () => {
        toast.success('Item added');
        setIsAddingItem(false);
        setNewItem({ productName: '', cases: '', bottlesPerCase: '12', bottleSizeMl: '750', productCostPerBottle: '' });
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

  const { mutate: updateItem, isPending: isUpdatingItem } = useMutation(
    api.logistics.admin.updateItem.mutationOptions({
      onSuccess: () => {
        toast.success('Item updated');
        setSheetItemId(null);
        setEditingPackItemId(null);
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: syncToZoho, isPending: isSyncingToZoho } = useMutation(
    api.logistics.admin.syncItemsToZoho.mutationOptions({
      onSuccess: (result) => {
        if (result.success) {
          toast.success(`Synced to Zoho: ${result.summary.created} created, ${result.summary.exists} already exist`);
        } else {
          toast.warning(`Sync completed with errors: ${result.summary.errors} failed`);
        }
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

  const { mutate: deleteShipment, isPending: isDeleting } = useMutation(
    api.logistics.admin.delete.mutationOptions({
      onSuccess: () => {
        toast.success('Shipment deleted');
        router.push('/platform/admin/logistics/shipments');
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleStatusChange = (status: ShipmentStatus) => {
    updateStatus({ id: shipmentId, status });
  };

  const handlePartnerChange = (partnerId: string) => {
    updateShipment({ id: shipmentId, partnerId: partnerId || null });
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
      bottleSizeMl: parseInt(newItem.bottleSizeMl, 10) || 750,
      productCostPerBottle: newItem.productCostPerBottle ? parseFloat(newItem.productCostPerBottle) : undefined,
    });
  };

  const handleLwinSelect = (itemId: string, result: LwinLookupResult) => {
    // Auto-detect HS code: sparkling = 22041000, still wine = 22042100
    const text = `${result.classification ?? ''} ${result.displayName}`.toLowerCase();
    const isSparkling = ['champagne', 'sparkling', 'cava', 'prosecco', 'cremant', 'sekt', 'spumante']
      .some((t) => text.includes(t));

    updateItem({
      itemId,
      lwin: result.lwin18,
      producer: result.producer || undefined,
      vintage: result.vintage || undefined,
      region: result.region || undefined,
      countryOfOrigin: result.country || undefined,
      hsCode: isSparkling ? '22041000' : '22042100',
      bottlesPerCase: result.caseSize,
      bottleSizeMl: result.bottleSizeMl,
    });
  };

  const handleSavePack = (itemId: string) => {
    const bpc = parseInt(editPack.bottlesPerCase, 10);
    const bsml = parseInt(editPack.bottleSizeMl, 10);
    if (!bpc || bpc < 1 || !bsml || bsml < 1) return;
    updateItem({ itemId, bottlesPerCase: bpc, bottleSizeMl: bsml });
    setEditingPackItemId(null);
  };

  const handleUseSupplierSku = (itemId: string, supplierSku: string) => {
    updateItem({
      itemId,
      lwin: supplierSku, // Use supplier SKU as the identifier
      supplierSku: supplierSku,
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
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteShipment({ id: shipmentId })}
                  disabled={isDeleting}
                >
                  <ButtonContent iconLeft={IconTrash}>Confirm</ButtonContent>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                  <Icon icon={IconX} size="sm" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                <Icon icon={IconTrash} size="sm" />
              </Button>
            )}
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
                  <div className="flex justify-between items-center">
                    <dt className="text-text-muted">Partner</dt>
                    <dd>
                      <Select
                        value={shipment.partnerId ?? ''}
                        onValueChange={handlePartnerChange}
                        disabled={isUpdatingShipment}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder="Select partner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {partners?.map((partner) => (
                            <SelectItem key={partner.id} value={partner.id}>
                              {partner.businessName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </dd>
                  </div>
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

        {activeTab === 'items' && (() => {
          const items = shipment.items ?? [];
          const mappedCount = items.filter((i) => i.lwin).length;
          const totalItems = items.length;
          const lwinSheetItem = items.find((i) => i.id === sheetItemId) ?? null;
          const totalCases = items.reduce((sum, i) => sum + (i.cases ?? 0), 0);
          const totalBottles = items.reduce((sum, i) => sum + (i.totalBottles ?? 0), 0);

          const openSheet = (item: typeof items[number]) => {
            setSheetItemId(item.id);
            setSheetForm({
              productName: item.productName,
              producer: item.producer ?? '',
              vintage: item.vintage ? String(item.vintage) : '',
              region: item.region ?? '',
              countryOfOrigin: item.countryOfOrigin ?? '',
              hsCode: item.hsCode ?? '',
              cases: String(item.cases),
              bottlesPerCase: String(item.bottlesPerCase || 12),
              bottleSizeMl: String(item.bottleSizeMl || 750),
              productCostPerBottle: item.productCostPerBottle ? String(item.productCostPerBottle) : '',
            });
          };

          const handleSaveSheet = () => {
            if (!sheetItemId) return;
            updateItem({
              itemId: sheetItemId,
              ...(sheetForm.productName && { productName: sheetForm.productName }),
              producer: sheetForm.producer || null,
              vintage: sheetForm.vintage ? parseInt(sheetForm.vintage, 10) : null,
              region: sheetForm.region || null,
              countryOfOrigin: sheetForm.countryOfOrigin || null,
              hsCode: sheetForm.hsCode || null,
              cases: sheetForm.cases ? parseInt(sheetForm.cases, 10) : undefined,
              bottlesPerCase: sheetForm.bottlesPerCase ? parseInt(sheetForm.bottlesPerCase, 10) : null,
              bottleSizeMl: sheetForm.bottleSizeMl ? parseInt(sheetForm.bottleSizeMl, 10) : null,
              productCostPerBottle: sheetForm.productCostPerBottle ? parseFloat(sheetForm.productCostPerBottle) : null,
            });
          };

          return (
            <div className="space-y-4">
              {/* Mapping Progress Bar */}
              {totalItems > 0 && (
                <Card>
                  <CardContent className="px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <Typography variant="bodySm" className="font-medium">
                        LWIN Mapping
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        {mappedCount} of {totalItems} mapped
                      </Typography>
                    </div>
                    <div className="h-2 w-full rounded-full bg-fill-secondary">
                      <div
                        className={`h-2 rounded-full transition-all ${mappedCount === totalItems ? 'bg-green-500' : 'bg-amber-400'}`}
                        style={{ width: `${totalItems > 0 ? (mappedCount / totalItems) * 100 : 0}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Typography variant="headingSm">Items</Typography>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncToZoho({ shipmentId })}
                        disabled={isSyncingToZoho || !items.some((i) => i.lwin)}
                      >
                        <ButtonContent iconLeft={isSyncingToZoho ? IconLoader2 : IconCloud}>
                          {isSyncingToZoho ? 'Syncing...' : 'Sync to Zoho'}
                        </ButtonContent>
                      </Button>
                      <Button size="sm" onClick={() => setIsAddingItem(true)}>
                        <ButtonContent iconLeft={IconPlus}>Add Item</ButtonContent>
                      </Button>
                    </div>
                  </div>

                  {/* Add Item Form */}
                  {isAddingItem && (
                    <div className="mb-6 rounded-lg border border-border-brand/30 bg-fill-brand/5 p-4">
                      <Typography variant="bodySm" className="mb-3 font-medium">
                        New Item
                      </Typography>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                          <label className="text-xs font-medium text-text-muted">Product Name</label>
                          <Input
                            placeholder="e.g. Chateau Margaux 2018"
                            value={newItem.productName}
                            onChange={(e) => setNewItem((p) => ({ ...p, productName: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-text-muted">Cases</label>
                          <Input
                            type="number"
                            placeholder="20"
                            value={newItem.cases}
                            onChange={(e) => setNewItem((p) => ({ ...p, cases: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-text-muted">Bottles/Case</label>
                          <Input
                            type="number"
                            value={newItem.bottlesPerCase}
                            onChange={(e) => setNewItem((p) => ({ ...p, bottlesPerCase: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-text-muted">Bottle Size</label>
                          <select
                            value={newItem.bottleSizeMl}
                            onChange={(e) => setNewItem((p) => ({ ...p, bottleSizeMl: e.target.value }))}
                            className="w-full rounded-lg border border-border-primary bg-fill-primary px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          >
                            <option value="375">375ml (Half)</option>
                            <option value="500">500ml</option>
                            <option value="700">700ml</option>
                            <option value="750">750ml (Standard)</option>
                            <option value="1000">1000ml (1L)</option>
                            <option value="1500">1500ml (Magnum)</option>
                            <option value="3000">3000ml (Jeroboam)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-text-muted">Cost/Bottle (USD)</label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="12.00"
                            value={newItem.productCostPerBottle}
                            onChange={(e) => setNewItem((p) => ({ ...p, productCostPerBottle: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" onClick={handleAddItem} disabled={isAddingItemPending}>
                          <ButtonContent iconLeft={isAddingItemPending ? IconLoader2 : IconPlus}>
                            {isAddingItemPending ? 'Adding...' : 'Add Item'}
                          </ButtonContent>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setIsAddingItem(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Items Table */}
                  {!items.length ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Icon icon={IconPackage} size="lg" className="mb-3 text-text-muted" />
                      <Typography variant="bodySm" colorRole="muted">
                        No items added yet
                      </Typography>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => setIsAddingItem(true)}
                      >
                        <ButtonContent iconLeft={IconPlus}>Add First Item</ButtonContent>
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-6">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border-muted text-left text-xs uppercase tracking-wide text-text-muted">
                            <th className="pb-3 pl-6 pr-4">Product</th>
                            <th className="pb-3 pr-4">LWIN / SKU</th>
                            <th className="pb-3 pr-4 text-center">Pack</th>
                            <th className="pb-3 pr-4 text-right">Cases</th>
                            <th className="pb-3 pr-4 text-right">Bottles</th>
                            <th className="pb-3 pr-4 text-right">Cost/Btl</th>
                            <th className="pb-3 pr-4 text-right">Landed/Btl</th>
                            <th className="pb-3 pr-4 text-right">Margin</th>
                            <th className="pb-3 pr-6"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => {
                            // Skip vintage in metadata if already in product name
                            const vintageStr = item.vintage ? String(item.vintage) : null;
                            const showVintage = vintageStr && !item.productName.includes(vintageStr);
                            const metadata = [item.producer, showVintage ? vintageStr : null, item.region]
                              .filter(Boolean)
                              .join(' \u00b7 ');

                            return (
                              <tr
                                key={item.id}
                                className="border-b border-border-muted/50 transition-colors hover:bg-fill-secondary/50"
                              >
                                {/* Product — click to edit */}
                                <td className="py-3 pl-6 pr-4">
                                  <button
                                    onClick={() => openSheet(item)}
                                    className="text-left group"
                                  >
                                    <Typography variant="bodySm" className="font-medium leading-snug group-hover:text-text-brand transition-colors">
                                      {item.productName}
                                    </Typography>
                                    {metadata && (
                                      <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                                        {metadata}
                                      </Typography>
                                    )}
                                  </button>
                                </td>

                                {/* LWIN / SKU */}
                                <td className="py-3 pr-4">
                                  {item.lwin ? (
                                    <button
                                      onClick={() => openSheet(item)}
                                      className="group flex items-center gap-1.5"
                                      title={`LWIN: ${item.lwin} — Click to change`}
                                    >
                                      <Badge colorRole="success" size="xs">
                                        <Icon icon={IconCheck} size="sm" className="mr-0.5" />
                                        <span className="font-mono">{item.lwin}</span>
                                      </Badge>
                                      <Icon
                                        icon={IconPencil}
                                        size="sm"
                                        className="text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                                      />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openSheet(item)}
                                      className="group flex items-center gap-1.5"
                                    >
                                      <Badge colorRole="warning" size="xs">
                                        Not mapped
                                      </Badge>
                                      <span className="flex items-center gap-0.5 text-xs text-text-brand opacity-0 transition-opacity group-hover:opacity-100">
                                        <Icon icon={IconSearch} size="sm" />
                                        Map
                                      </span>
                                    </button>
                                  )}
                                </td>

                                {/* Pack */}
                                <td className="py-3 pr-4 text-center">
                                  {editingPackItemId === item.id ? (
                                    <div className="flex items-center gap-1 justify-center">
                                      <input
                                        type="number"
                                        value={editPack.bottlesPerCase}
                                        onChange={(e) =>
                                          setEditPack((p) => ({ ...p, bottlesPerCase: e.target.value }))
                                        }
                                        className="w-12 rounded border border-border-primary bg-fill-primary px-1.5 py-1 text-center text-xs"
                                        min={1}
                                      />
                                      <span className="text-xs text-text-muted">&times;</span>
                                      <input
                                        type="number"
                                        value={editPack.bottleSizeMl}
                                        onChange={(e) =>
                                          setEditPack((p) => ({ ...p, bottleSizeMl: e.target.value }))
                                        }
                                        className="w-16 rounded border border-border-primary bg-fill-primary px-1.5 py-1 text-center text-xs"
                                        min={1}
                                      />
                                      <span className="text-xs text-text-muted">ml</span>
                                      <button
                                        onClick={() => handleSavePack(item.id)}
                                        className="rounded p-0.5 text-green-600 hover:bg-green-50"
                                        disabled={isUpdatingItem}
                                      >
                                        <Icon icon={IconCheck} size="sm" />
                                      </button>
                                      <button
                                        onClick={() => setEditingPackItemId(null)}
                                        className="rounded p-0.5 text-text-muted hover:bg-fill-secondary"
                                      >
                                        <Icon icon={IconX} size="sm" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingPackItemId(item.id);
                                        setEditPack({
                                          bottlesPerCase: String(item.bottlesPerCase || 12),
                                          bottleSizeMl: String(item.bottleSizeMl || 750),
                                        });
                                      }}
                                      className="inline-flex items-center rounded-md border border-border-muted bg-fill-secondary/50 px-2 py-0.5 text-xs font-medium transition-colors hover:border-border-brand hover:bg-fill-brand/5"
                                      title="Click to edit pack size"
                                    >
                                      {item.bottlesPerCase || 12} &times; {(item.bottleSizeMl || 750) / 10}cl
                                    </button>
                                  )}
                                </td>

                                {/* Cases */}
                                <td className="py-3 pr-4 text-right tabular-nums">
                                  <button onClick={() => openSheet(item)} className="hover:text-text-brand transition-colors">
                                    {item.cases}
                                  </button>
                                </td>

                                {/* Bottles */}
                                <td className="py-3 pr-4 text-right tabular-nums">
                                  {item.totalBottles ?? '-'}
                                </td>

                                {/* Cost/Btl */}
                                <td className="py-3 pr-4 text-right tabular-nums">
                                  <button onClick={() => openSheet(item)} className="hover:text-text-brand transition-colors">
                                    {item.productCostPerBottle
                                      ? `$${item.productCostPerBottle.toFixed(2)}`
                                      : '-'}
                                  </button>
                                </td>

                                {/* Landed/Btl */}
                                <td className="py-3 pr-4 text-right tabular-nums">
                                  {item.landedCostPerBottle
                                    ? `$${item.landedCostPerBottle.toFixed(2)}`
                                    : '-'}
                                </td>

                                {/* Margin */}
                                <td className="py-3 pr-4 text-right tabular-nums">
                                  {item.marginPercent !== null && item.marginPercent !== undefined ? (
                                    <span
                                      className={
                                        item.marginPercent >= 0 ? 'text-green-600' : 'text-red-600'
                                      }
                                    >
                                      {item.marginPercent.toFixed(0)}%
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>

                                {/* Delete */}
                                <td className="py-3 pr-6">
                                  <button
                                    onClick={() => removeItem({ itemId: item.id })}
                                    className="rounded p-1 text-text-muted transition-colors hover:bg-fill-danger/10 hover:text-text-danger"
                                  >
                                    <Icon icon={IconTrash} size="sm" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {/* Summary Footer */}
                        <tfoot>
                          <tr className="text-xs font-medium text-text-muted">
                            <td className="pb-1 pl-6 pr-4 pt-3">
                              {totalItems} item{totalItems !== 1 ? 's' : ''}
                            </td>
                            <td className="pb-1 pr-4 pt-3"></td>
                            <td className="pb-1 pr-4 pt-3"></td>
                            <td className="pb-1 pr-4 pt-3 text-right tabular-nums font-semibold text-text-primary">
                              {totalCases}
                            </td>
                            <td className="pb-1 pr-4 pt-3 text-right tabular-nums font-semibold text-text-primary">
                              {totalBottles}
                            </td>
                            <td className="pb-1 pr-4 pt-3" colSpan={4}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Item Editor Sheet */}
              <Sheet open={!!lwinSheetItem} onOpenChange={(open) => { if (!open) setSheetItemId(null); }}>
                <SheetContent side="right" className="sm:max-w-lg overflow-y-auto p-6">
                  <SheetTitle className="mb-1">Edit Item</SheetTitle>
                  <SheetDescription className="mb-4 text-sm text-text-muted">
                    Update product details and LWIN mapping
                  </SheetDescription>

                  {lwinSheetItem && (
                    <div className="space-y-5">
                      {/* Editable Fields */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-text-muted">Product Name</label>
                          <Input
                            value={sheetForm.productName}
                            onChange={(e) => setSheetForm((f) => ({ ...f, productName: e.target.value }))}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-text-muted">Producer</label>
                            <Input
                              value={sheetForm.producer}
                              onChange={(e) => setSheetForm((f) => ({ ...f, producer: e.target.value }))}
                              placeholder="e.g. Chateau Margaux"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-text-muted">Vintage</label>
                            <Input
                              type="number"
                              value={sheetForm.vintage}
                              onChange={(e) => setSheetForm((f) => ({ ...f, vintage: e.target.value }))}
                              placeholder="NV"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-text-muted">Region</label>
                            <Input
                              value={sheetForm.region}
                              onChange={(e) => setSheetForm((f) => ({ ...f, region: e.target.value }))}
                              placeholder="e.g. Bordeaux"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-text-muted">Country</label>
                            <Input
                              value={sheetForm.countryOfOrigin}
                              onChange={(e) => setSheetForm((f) => ({ ...f, countryOfOrigin: e.target.value }))}
                              placeholder="e.g. France"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-text-muted">HS Code</label>
                          <select
                            value={sheetForm.hsCode}
                            onChange={(e) => setSheetForm((f) => ({ ...f, hsCode: e.target.value }))}
                            className="w-full rounded-lg border border-border-primary bg-fill-primary px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          >
                            <option value="">Not set</option>
                            {HS_CODES.map((hs) => (
                              <option key={hs.value} value={hs.value}>
                                {hs.value} — {hs.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-text-muted">Cases</label>
                            <Input
                              type="number"
                              value={sheetForm.cases}
                              onChange={(e) => setSheetForm((f) => ({ ...f, cases: e.target.value }))}
                              min={1}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-text-muted">Btl/Case</label>
                            <Input
                              type="number"
                              value={sheetForm.bottlesPerCase}
                              onChange={(e) => setSheetForm((f) => ({ ...f, bottlesPerCase: e.target.value }))}
                              min={1}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-text-muted">Bottle Size</label>
                            <select
                              value={sheetForm.bottleSizeMl}
                              onChange={(e) => setSheetForm((f) => ({ ...f, bottleSizeMl: e.target.value }))}
                              className="w-full rounded-lg border border-border-primary bg-fill-primary px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            >
                              <option value="375">375ml</option>
                              <option value="500">500ml</option>
                              <option value="700">700ml</option>
                              <option value="750">750ml</option>
                              <option value="1000">1L</option>
                              <option value="1500">1.5L</option>
                              <option value="3000">3L</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-text-muted">Cost/Bottle (USD)</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={sheetForm.productCostPerBottle}
                            onChange={(e) => setSheetForm((f) => ({ ...f, productCostPerBottle: e.target.value }))}
                            placeholder="0.00"
                          />
                        </div>
                        <Button className="w-full" onClick={handleSaveSheet} disabled={isUpdatingItem}>
                          <ButtonContent iconLeft={isUpdatingItem ? IconLoader2 : IconCheck}>
                            {isUpdatingItem ? 'Saving...' : 'Save Changes'}
                          </ButtonContent>
                        </Button>
                      </div>

                      {/* LWIN Mapping */}
                      <div className="border-t border-border-muted pt-4">
                        <Typography variant="bodySm" className="font-medium mb-3">
                          LWIN Mapping
                        </Typography>
                        {lwinSheetItem.lwin && (
                          <div className="mb-3 rounded-lg bg-green-50 p-2 dark:bg-green-900/20">
                            <Typography variant="bodyXs" className="font-mono text-green-700 dark:text-green-400">
                              Current: {lwinSheetItem.lwin}
                            </Typography>
                          </div>
                        )}
                        <LwinLookup
                          productName={lwinSheetItem.productName}
                          defaultCaseSize={lwinSheetItem.bottlesPerCase || 12}
                          defaultBottleSize={lwinSheetItem.bottleSizeMl || 750}
                          defaultVintage={lwinSheetItem.vintage ?? undefined}
                          onSelect={(result) => handleLwinSelect(lwinSheetItem.id, result)}
                          disabled={isUpdatingItem}
                        />
                        {lwinSheetItem.supplierSku && !lwinSheetItem.lwin && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 w-full"
                            onClick={() => handleUseSupplierSku(lwinSheetItem.id, lwinSheetItem.supplierSku!)}
                            disabled={isUpdatingItem}
                          >
                            Use SKU: {lwinSheetItem.supplierSku}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </SheetContent>
              </Sheet>
            </div>
          );
        })()}

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
