'use client';

import {
  IconAlertCircle,
  IconBarcode,
  IconCheck,
  IconChevronRight,
  IconEdit,
  IconLoader2,
  IconMinus,
  IconPlus,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

interface ReceivedItem {
  shipmentItemId: string;
  expectedCases: number;
  receivedCases: number;
  // Pack configuration - track if changed from expected
  expectedBottlesPerCase: number;
  expectedBottleSizeMl: number;
  receivedBottlesPerCase: number;
  receivedBottleSizeMl: number;
  packChanged: boolean;
  expiryDate?: Date;
  notes?: string;
}

/**
 * WMS Receive Shipment - enter received quantities
 */
const WMSReceiveShipmentPage = () => {
  const params = useParams();
  const router = useRouter();
  const shipmentId = params.shipmentId as string;
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [receivedItems, setReceivedItems] = useState<Map<string, ReceivedItem>>(new Map());
  const [notes, setNotes] = useState('');
  const [receivingLocationId, setReceivingLocationId] = useState<string>('');

  // Get shipment details
  const { data: shipment, isLoading: shipmentLoading } = useQuery({
    ...api.wms.admin.receiving.getShipmentForReceiving.queryOptions({ shipmentId }),
    enabled: !!shipmentId,
  });

  // Get locations (to select RECEIVING location)
  const { data: locations } = useQuery({
    ...api.wms.admin.locations.getMany.queryOptions({}),
  });

  // Find RECEIVING location
  const receivingLocation = locations?.find((l) => l.locationType === 'receiving');

  // Initialize received items from shipment items
  useState(() => {
    if (shipment?.items && receivedItems.size === 0) {
      const initial = new Map<string, ReceivedItem>();
      shipment.items.forEach((item) => {
        initial.set(item.id, {
          shipmentItemId: item.id,
          expectedCases: item.cases,
          receivedCases: item.cases, // Default to expected
          expectedBottlesPerCase: item.bottlesPerCase ?? 12,
          expectedBottleSizeMl: item.bottleSizeMl ?? 750,
          receivedBottlesPerCase: item.bottlesPerCase ?? 12,
          receivedBottleSizeMl: item.bottleSizeMl ?? 750,
          packChanged: false,
        });
      });
      setReceivedItems(initial);
    }
  });

  // Update received items when shipment loads
  if (shipment?.items && receivedItems.size === 0) {
    const initial = new Map<string, ReceivedItem>();
    shipment.items.forEach((item) => {
      initial.set(item.id, {
        shipmentItemId: item.id,
        expectedCases: item.cases,
        receivedCases: item.cases,
        expectedBottlesPerCase: item.bottlesPerCase ?? 12,
        expectedBottleSizeMl: item.bottleSizeMl ?? 750,
        receivedBottlesPerCase: item.bottlesPerCase ?? 12,
        receivedBottleSizeMl: item.bottleSizeMl ?? 750,
        packChanged: false,
      });
    });
    setReceivedItems(initial);
  }

  // Set receiving location when locations load
  if (receivingLocation && !receivingLocationId) {
    setReceivingLocationId(receivingLocation.id);
  }

  const updateReceivedCases = (itemId: string, cases: number) => {
    const item = receivedItems.get(itemId);
    if (item) {
      setReceivedItems(new Map(receivedItems.set(itemId, { ...item, receivedCases: Math.max(0, cases) })));
    }
  };

  const updatePackConfig = (itemId: string, bottlesPerCase: number, bottleSizeMl: number) => {
    const item = receivedItems.get(itemId);
    if (item) {
      const packChanged =
        bottlesPerCase !== item.expectedBottlesPerCase || bottleSizeMl !== item.expectedBottleSizeMl;
      setReceivedItems(
        new Map(
          receivedItems.set(itemId, {
            ...item,
            receivedBottlesPerCase: bottlesPerCase,
            receivedBottleSizeMl: bottleSizeMl,
            packChanged,
          }),
        ),
      );
    }
  };

  // State for editing pack config
  const [editingPackItemId, setEditingPackItemId] = useState<string | null>(null);

  const receiveMutation = useMutation({
    ...api.wms.admin.receiving.receiveShipment.mutationOptions(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries();
      // Redirect to labels page
      router.push(`/platform/admin/wms/labels?shipmentId=${shipmentId}&totalLabels=${data.totalCaseLabels}`);
    },
  });

  const handleReceive = () => {
    if (!receivingLocationId) {
      alert('Please select a receiving location');
      return;
    }

    const items = Array.from(receivedItems.values())
      .filter((item) => item.receivedCases > 0)
      .map((item) => ({
        shipmentItemId: item.shipmentItemId,
        expectedCases: item.expectedCases,
        receivedCases: item.receivedCases,
        receivedBottlesPerCase: item.receivedBottlesPerCase,
        receivedBottleSizeMl: item.receivedBottleSizeMl,
        packChanged: item.packChanged,
        expiryDate: item.expiryDate,
        notes: item.notes,
      }));

    if (items.length === 0) {
      alert('No items to receive');
      return;
    }

    receiveMutation.mutate({
      shipmentId,
      receivingLocationId,
      items,
      notes: notes || undefined,
    });
  };

  if (shipmentLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <Icon icon={IconAlertCircle} size="xl" colorRole="muted" className="mx-auto mb-4" />
            <Typography variant="headingSm" className="mb-2">
              Shipment Not Found
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              The shipment could not be found or is not ready for receiving
            </Typography>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalExpected = shipment.items.reduce((sum, item) => sum + item.cases, 0);
  const totalReceived = Array.from(receivedItems.values()).reduce((sum, item) => sum + item.receivedCases, 0);
  const hasDiscrepancy = totalExpected !== totalReceived;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Link href="/platform/admin/wms" className="text-text-muted hover:text-text-primary">
                <Typography variant="bodySm">WMS</Typography>
              </Link>
              <IconChevronRight className="h-4 w-4 text-text-muted" />
              <Link href="/platform/admin/wms/receive" className="text-text-muted hover:text-text-primary">
                <Typography variant="bodySm">Receiving</Typography>
              </Link>
              <IconChevronRight className="h-4 w-4 text-text-muted" />
              <Typography variant="bodySm">{shipment.shipmentNumber}</Typography>
            </div>
            <Typography variant="headingLg" className="mb-2">
              Receive: {shipment.shipmentNumber}
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              {shipment.partnerName} • {shipment.originCountry ?? 'Unknown'} {shipment.originCity && `• ${shipment.originCity}`}
            </Typography>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={handleReceive}
              disabled={receiveMutation.isPending || totalReceived === 0}
            >
              <ButtonContent iconLeft={receiveMutation.isPending ? IconLoader2 : IconCheck}>
                {receiveMutation.isPending ? 'Receiving...' : 'Complete Receiving'}
              </ButtonContent>
            </Button>
          </div>
        </div>

        {/* Summary Card */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="bodyXs" colorRole="muted">
                Expected
              </Typography>
              <Typography variant="headingLg" className="text-blue-600">
                {totalExpected}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                cases
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="bodyXs" colorRole="muted">
                Received
              </Typography>
              <Typography
                variant="headingLg"
                className={hasDiscrepancy ? 'text-amber-600' : 'text-emerald-600'}
              >
                {totalReceived}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                cases
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="bodyXs" colorRole="muted">
                Variance
              </Typography>
              <Typography
                variant="headingLg"
                className={
                  totalReceived - totalExpected === 0
                    ? 'text-text-muted'
                    : totalReceived - totalExpected > 0
                      ? 'text-emerald-600'
                      : 'text-red-600'
                }
              >
                {totalReceived - totalExpected > 0 ? '+' : ''}
                {totalReceived - totalExpected}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                cases
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* Items to Receive */}
        <Card>
          <div className="p-4 pb-2">
            <CardTitle>Items to Receive</CardTitle>
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-border-muted">
              {shipment.items.map((item) => {
                const received = receivedItems.get(item.id);
                const variance = (received?.receivedCases ?? 0) - item.cases;
                const isEditingPack = editingPackItemId === item.id;

                return (
                  <div key={item.id} className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="flex-1 min-w-0">
                        <Typography variant="headingSm" className="mb-1">
                          {item.productName}
                        </Typography>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Typography variant="bodyXs" colorRole="muted">
                            {item.producer && `${item.producer} • `}
                            {item.vintage && `${item.vintage}`}
                          </Typography>
                          {/* Pack Config with Edit */}
                          <div className="flex items-center gap-1">
                            {isEditingPack ? (
                              <div className="flex items-center gap-2 rounded-md bg-fill-secondary p-1">
                                <select
                                  className="rounded border border-border-primary bg-fill-primary px-2 py-1 text-xs"
                                  value={received?.receivedBottlesPerCase ?? 6}
                                  onChange={(e) =>
                                    updatePackConfig(
                                      item.id,
                                      parseInt(e.target.value),
                                      received?.receivedBottleSizeMl ?? 750,
                                    )
                                  }
                                >
                                  <option value={1}>1</option>
                                  <option value={3}>3</option>
                                  <option value={6}>6</option>
                                  <option value={12}>12</option>
                                  <option value={24}>24</option>
                                </select>
                                <span className="text-xs">×</span>
                                <select
                                  className="rounded border border-border-primary bg-fill-primary px-2 py-1 text-xs"
                                  value={received?.receivedBottleSizeMl ?? 750}
                                  onChange={(e) =>
                                    updatePackConfig(
                                      item.id,
                                      received?.receivedBottlesPerCase ?? 6,
                                      parseInt(e.target.value),
                                    )
                                  }
                                >
                                  <option value={375}>375ml</option>
                                  <option value={500}>500ml</option>
                                  <option value={750}>750ml</option>
                                  <option value={1500}>1500ml</option>
                                  <option value={3000}>3000ml</option>
                                </select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => setEditingPackItemId(null)}
                                >
                                  <Icon icon={IconCheck} size="sm" />
                                </Button>
                              </div>
                            ) : (
                              <button
                                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-fill-secondary ${
                                  received?.packChanged
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                    : 'text-text-muted'
                                }`}
                                onClick={() => setEditingPackItemId(item.id)}
                              >
                                {received?.receivedBottlesPerCase ?? item.bottlesPerCase}x
                                {received?.receivedBottleSizeMl ?? item.bottleSizeMl}ml
                                <Icon icon={IconEdit} size="xs" />
                              </button>
                            )}
                          </div>
                        </div>
                        {/* LWIN */}
                        {item.lwin && (
                          <Typography variant="bodyXs" className="mt-1 font-mono text-text-muted">
                            {item.lwin}
                          </Typography>
                        )}
                        {/* Pack changed indicator */}
                        {received?.packChanged && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                            <span>
                              Originally: {item.bottlesPerCase}x{item.bottleSizeMl}ml → Now:{' '}
                              {received.receivedBottlesPerCase}x{received.receivedBottleSizeMl}ml
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Typography variant="bodyXs" colorRole="muted">
                            Expected
                          </Typography>
                          <Typography variant="bodySm" className="font-medium">
                            {item.cases} cases
                          </Typography>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateReceivedCases(item.id, (received?.receivedCases ?? 0) - 1)}
                          >
                            <Icon icon={IconMinus} size="sm" />
                          </Button>
                          <Input
                            type="number"
                            className="w-20 text-center"
                            value={received?.receivedCases ?? 0}
                            onChange={(e) => updateReceivedCases(item.id, parseInt(e.target.value) || 0)}
                            min={0}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateReceivedCases(item.id, (received?.receivedCases ?? 0) + 1)}
                          >
                            <Icon icon={IconPlus} size="sm" />
                          </Button>
                        </div>
                        {variance !== 0 && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              variance > 0
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            }`}
                          >
                            {variance > 0 ? '+' : ''}
                            {variance}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <div className="p-4 pb-2">
            <CardTitle>Receiving Notes</CardTitle>
          </div>
          <CardContent>
            <textarea
              className="w-full rounded-lg border border-border-primary bg-fill-primary p-3 text-sm focus:border-border-brand focus:outline-none"
              rows={3}
              placeholder="Add any notes about discrepancies, damage, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href="/platform/admin/wms/receive">Cancel</Link>
          </Button>
          <Button
            variant="primary"
            onClick={handleReceive}
            disabled={receiveMutation.isPending || totalReceived === 0}
          >
            <ButtonContent iconLeft={receiveMutation.isPending ? IconLoader2 : IconBarcode}>
              {receiveMutation.isPending ? 'Receiving...' : `Receive & Print ${totalReceived} Labels`}
            </ButtonContent>
          </Button>
        </div>

        {/* Error Display */}
        {receiveMutation.isError && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Icon icon={IconAlertCircle} size="sm" className="text-red-600" />
                <Typography variant="bodySm" className="text-red-800 dark:text-red-300">
                  {receiveMutation.error?.message ?? 'Failed to receive shipment'}
                </Typography>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WMSReceiveShipmentPage;
