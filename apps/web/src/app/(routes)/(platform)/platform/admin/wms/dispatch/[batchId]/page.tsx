'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconDownload,
  IconFileText,
  IconLoader2,
  IconPackage,
  IconPlus,
  IconTrash,
  IconTruck,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import downloadZplFile from '@/app/_wms/utils/downloadZplFile';
import { generateBatchLabelsZpl } from '@/app/_wms/utils/generateLabelZpl';
import useTRPC from '@/lib/trpc/browser';

/**
 * WMS Dispatch Batch Detail
 */
const WMSDispatchBatchDetailPage = () => {
  const params = useParams();
  const api = useTRPC();
  const queryClient = useQueryClient();
  const batchId = params.batchId as string;

  const [showAddOrders, setShowAddOrders] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Fetch batch
  const { data: batch, isLoading } = useQuery({
    ...api.wms.admin.dispatch.getOne.queryOptions({ batchId }),
  });

  // Fetch available PCO orders for adding
  const { data: availablePcoOrders } = useQuery({
    ...api.privateClientOrders.admin.getMany.queryOptions({
      status: 'cc_approved',
      limit: 50,
    }),
    enabled: showAddOrders,
  });

  // Fetch available Zoho Sales Orders (picked, not yet in a batch)
  const { data: availableZohoOrders } = useQuery({
    ...api.zohoSalesOrders.getPickedForDispatch.queryOptions({
      distributorName: batch?.distributorName ?? undefined,
    }),
    enabled: showAddOrders && !!batch?.distributorName,
  });

  // Combine available orders
  const availableOrders = {
    orders: [
      ...(availableZohoOrders?.orders ?? []).map((o) => ({
        id: o.id,
        orderNumber: o.salesOrderNumber,
        clientName: o.customerName,
        totalCases: o.totalCases,
        type: 'zoho' as const,
      })),
      ...(availablePcoOrders?.orders ?? []).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        clientName: o.clientName,
        totalCases: o.totalCases,
        type: 'pco' as const,
      })),
    ],
  };

  // Add PCO orders mutation
  const addPcoOrdersMutation = useMutation({
    ...api.wms.admin.dispatch.addOrders.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      setShowAddOrders(false);
      setSelectedOrderIds([]);
    },
  });

  // Add Zoho orders mutation
  const addZohoOrdersMutation = useMutation({
    ...api.wms.admin.dispatch.addZohoOrders.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      setShowAddOrders(false);
      setSelectedOrderIds([]);
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    ...api.wms.admin.dispatch.updateStatus.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });

  // Remove order mutation
  const removeOrderMutation = useMutation({
    ...api.wms.admin.dispatch.removeOrder.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });

  // Generate delivery note mutation
  const generateDeliveryNoteMutation = useMutation({
    ...api.wms.admin.dispatch.generateDeliveryNote.mutationOptions(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries();
      // Open the PDF in a new tab
      if (data.deliveryNote.pdfUrl) {
        window.open(data.deliveryNote.pdfUrl, '_blank');
      }
    },
  });

  const handleAddOrders = () => {
    if (selectedOrderIds.length === 0) return;

    // Separate orders by type
    const zohoOrderIds = selectedOrderIds.filter((id) =>
      availableOrders.orders.find((o) => o.id === id && o.type === 'zoho'),
    );
    const pcoOrderIds = selectedOrderIds.filter((id) =>
      availableOrders.orders.find((o) => o.id === id && o.type === 'pco'),
    );

    // Add Zoho orders if any
    if (zohoOrderIds.length > 0) {
      addZohoOrdersMutation.mutate({ batchId, orderIds: zohoOrderIds });
    }
    // Add PCO orders if any
    if (pcoOrderIds.length > 0) {
      addPcoOrdersMutation.mutate({ batchId, orderIds: pcoOrderIds });
    }
  };

  const addOrdersMutation = {
    isPending: addPcoOrdersMutation.isPending || addZohoOrdersMutation.isPending,
    isError: addPcoOrdersMutation.isError || addZohoOrdersMutation.isError,
    error: addPcoOrdersMutation.error ?? addZohoOrdersMutation.error,
  };

  const handleUpdateStatus = (status: 'picking' | 'staged' | 'dispatched' | 'delivered') => {
    updateStatusMutation.mutate({ batchId, status });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
      picking: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      staged: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      dispatched: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      delivered: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    };
    return (
      <span className={`rounded px-2 py-1 text-sm font-medium ${colors[status] || 'bg-fill-secondary text-text-muted'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Icon icon={IconLoader2} className="animate-spin" size="lg" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-6">
        <Typography variant="headingMd">Batch not found</Typography>
      </div>
    );
  }

  const canAddOrders = batch.status === 'draft' || batch.status === 'picking' || batch.status === 'staged';
  const canDispatch = batch.status === 'staged' && batch.orderCount > 0;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/platform/admin/wms/dispatch">
            <Button variant="ghost" size="sm">
              <Icon icon={IconArrowLeft} size="sm" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Typography variant="headingMd">{batch.batchNumber}</Typography>
              {getStatusBadge(batch.status ?? 'draft')}
            </div>
            <Typography variant="bodySm" colorRole="muted">
              {batch.distributorName}
            </Typography>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg">{batch.orderCount}</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Orders
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg">{batch.totalCases}</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Cases
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg">{batch.palletCount ?? 1}</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Pallets
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {canAddOrders && (
            <Button variant="outline" onClick={() => setShowAddOrders(true)}>
              <ButtonContent iconLeft={IconPlus}>Add Orders</ButtonContent>
            </Button>
          )}
          {batch.status === 'draft' && (
            <Button
              variant="default"
              onClick={() => handleUpdateStatus('picking')}
              disabled={updateStatusMutation.isPending || batch.orderCount === 0}
            >
              <ButtonContent iconLeft={updateStatusMutation.isPending ? IconLoader2 : IconPackage}>
                Start Picking
              </ButtonContent>
            </Button>
          )}
          {batch.status === 'picking' && (
            <Button
              variant="default"
              onClick={() => handleUpdateStatus('staged')}
              disabled={updateStatusMutation.isPending}
            >
              <ButtonContent iconLeft={updateStatusMutation.isPending ? IconLoader2 : IconCheck}>
                Mark Staged
              </ButtonContent>
            </Button>
          )}
          {canDispatch && (
            <Button
              variant="default"
              onClick={() => handleUpdateStatus('dispatched')}
              disabled={updateStatusMutation.isPending}
            >
              <ButtonContent iconLeft={updateStatusMutation.isPending ? IconLoader2 : IconTruck}>
                Dispatch
              </ButtonContent>
            </Button>
          )}
          {batch.status === 'dispatched' && (
            <Button
              variant="outline"
              onClick={() => handleUpdateStatus('delivered')}
              disabled={updateStatusMutation.isPending}
            >
              <ButtonContent iconLeft={updateStatusMutation.isPending ? IconLoader2 : IconCheck}>
                Mark Delivered
              </ButtonContent>
            </Button>
          )}
          {batch.ordersWithoutDeliveryNote > 0 && (
            <Button
              variant="outline"
              onClick={() => generateDeliveryNoteMutation.mutate({ batchId })}
              disabled={generateDeliveryNoteMutation.isPending}
            >
              <ButtonContent iconLeft={generateDeliveryNoteMutation.isPending ? IconLoader2 : IconFileText}>
                {generateDeliveryNoteMutation.isPending
                  ? 'Generating...'
                  : `Generate Delivery Note (${batch.ordersWithoutDeliveryNote})`}
              </ButtonContent>
            </Button>
          )}
          {(batch.status === 'staged' || batch.status === 'picking') && batch.totalCases > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                // Generate labels for dispatch batch
                // For now, generate placeholder labels - can be enhanced later
                const labels = Array.from({ length: batch.totalCases }, (_, idx) => ({
                  barcode: `BATCH-${batch.batchNumber}-${String(idx + 1).padStart(3, '0')}`,
                  productName: `Dispatch Batch ${batch.batchNumber}`,
                  lwin18: batch.batchNumber,
                  packSize: '',
                  lotNumber: batch.batchNumber,
                  locationCode: batch.distributorName ?? undefined,
                }));
                const zpl = generateBatchLabelsZpl(labels);
                downloadZplFile(zpl, `dispatch-${batch.batchNumber}`);
              }}
            >
              <ButtonContent iconLeft={IconDownload}>
                Download Case Labels ({batch.totalCases})
              </ButtonContent>
            </Button>
          )}
        </div>

        {/* Orders List */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <Typography variant="headingSm">Orders in Batch</Typography>
              {batch.ordersWithoutDeliveryNote > 0 && (
                <Typography variant="bodyXs" className="text-amber-600">
                  {batch.ordersWithoutDeliveryNote} without delivery note
                </Typography>
              )}
            </div>
            {batch.orders.length === 0 ? (
              <div className="py-8 text-center">
                <Icon icon={IconPackage} size="lg" colorRole="muted" className="mx-auto mb-2" />
                <Typography variant="bodySm" colorRole="muted">
                  No orders added yet
                </Typography>
              </div>
            ) : (
              <div className="space-y-2">
                {batch.orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-lg bg-fill-secondary p-3"
                  >
                    <div>
                      <Typography variant="bodySm" className="font-medium">
                        {order.orderNumber}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        Added {new Date(order.addedAt).toLocaleDateString()}
                      </Typography>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.deliveryNoteId ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                          DN assigned
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          Pending DN
                        </span>
                      )}
                      {canAddOrders && (
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => removeOrderMutation.mutate({ batchId, orderId: order.orderId })}
                          disabled={removeOrderMutation.isPending}
                        >
                          <Icon
                            icon={removeOrderMutation.isPending ? IconLoader2 : IconTrash}
                            size="sm"
                            className={removeOrderMutation.isPending ? 'animate-spin' : 'text-red-500'}
                          />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Notes */}
        {batch.deliveryNotes.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <Typography variant="headingSm" className="mb-4">
                Delivery Notes
              </Typography>
              <div className="space-y-2">
                {batch.deliveryNotes.map((dn) => (
                  <div
                    key={dn.id}
                    className="flex items-center justify-between rounded-lg bg-fill-secondary p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Icon icon={IconFileText} size="sm" colorRole="muted" />
                      <div>
                        <Typography variant="bodySm" className="font-medium">
                          {dn.deliveryNoteNumber}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {dn.orderCount} orders • {dn.totalCases} cases
                        </Typography>
                      </div>
                    </div>
                    {dn.pdfUrl && (
                      <a
                        href={dn.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        View PDF
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dispatch Info */}
        {batch.dispatchedAt && (
          <Card>
            <CardContent className="p-4">
              <Typography variant="headingSm" className="mb-2">
                Dispatch Info
              </Typography>
              <div className="space-y-1">
                <Typography variant="bodySm">
                  <span className="text-text-muted">Dispatched:</span>{' '}
                  {new Date(batch.dispatchedAt).toLocaleString()}
                </Typography>
                {batch.dispatchedByName && (
                  <Typography variant="bodySm">
                    <span className="text-text-muted">By:</span> {batch.dispatchedByName}
                  </Typography>
                )}
                {batch.deliveredAt && (
                  <Typography variant="bodySm">
                    <span className="text-text-muted">Delivered:</span>{' '}
                    {new Date(batch.deliveredAt).toLocaleString()}
                  </Typography>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Orders Modal */}
      {showAddOrders && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowAddOrders(false)}
        >
          <Card
            className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-4 border-b border-border-primary">
              <div className="flex items-center justify-between">
                <Typography variant="headingSm">Add Orders to Batch</Typography>
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowAddOrders(false)}>
                  <Icon icon={IconX} size="sm" />
                </Button>
              </div>
            </CardContent>
            <div className="flex-1 overflow-y-auto p-4">
              {!availableOrders?.orders.length ? (
                <Typography variant="bodySm" colorRole="muted" className="text-center py-8">
                  No confirmed orders available
                </Typography>
              ) : (
                <div className="space-y-2">
                  {availableOrders.orders.map((order) => {
                    const isSelected = selectedOrderIds.includes(order.id);
                    const isAlreadyInBatch = batch.orders.some((o) => o.orderId === order.id);
                    return (
                      <button
                        key={order.id}
                        onClick={() => !isAlreadyInBatch && toggleOrderSelection(order.id)}
                        disabled={isAlreadyInBatch}
                        className={`w-full rounded-lg p-3 text-left transition-colors ${
                          isAlreadyInBatch
                            ? 'bg-fill-secondary opacity-50 cursor-not-allowed'
                            : isSelected
                              ? 'bg-brand-100 border-2 border-brand-500 dark:bg-brand-900/30'
                              : 'bg-fill-secondary hover:bg-fill-secondary/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <Typography variant="bodySm" className="font-medium">
                              {order.orderNumber}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              {order.clientName ?? 'Unknown client'} • {order.totalCases ?? 0} cases
                            </Typography>
                          </div>
                          {isAlreadyInBatch ? (
                            <span className="text-xs text-text-muted">Already added</span>
                          ) : (
                            <div
                              className={`h-5 w-5 rounded border-2 ${
                                isSelected
                                  ? 'border-brand-500 bg-brand-500'
                                  : 'border-border-primary'
                              }`}
                            >
                              {isSelected && (
                                <Icon icon={IconCheck} size="sm" className="text-white" />
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <CardContent className="p-4 border-t border-border-primary">
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" type="button" onClick={() => setShowAddOrders(false)}>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={handleAddOrders}
                  disabled={selectedOrderIds.length === 0 || addOrdersMutation.isPending}
                >
                  <ButtonContent iconLeft={addOrdersMutation.isPending ? IconLoader2 : IconPlus}>
                    {addOrdersMutation.isPending
                      ? 'Adding...'
                      : `Add ${selectedOrderIds.length} Order${selectedOrderIds.length !== 1 ? 's' : ''}`}
                  </ButtonContent>
                </Button>
              </div>
              {addOrdersMutation.isError && (
                <Typography variant="bodyXs" className="mt-2 text-center text-red-600">
                  {addOrdersMutation.error?.message}
                </Typography>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WMSDispatchBatchDetailPage;
