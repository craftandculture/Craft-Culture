'use client';

import {
  IconArrowLeft,
  IconBox,
  IconCheck,
  IconDownload,
  IconLoader2,
  IconLock,
  IconMapPin,
  IconScan,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import downloadZplFile from '@/app/_wms/utils/downloadZplFile';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

/**
 * WMS Pallet Detail - View and manage pallet contents
 */
const WMSPalletDetailPage = () => {
  const params = useParams();
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const palletId = params.palletId as string;

  const [scanInput, setScanInput] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [lastScanResult, setLastScanResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Fetch pallet
  const { data, isLoading, refetch } = useQuery({
    ...api.wms.admin.pallets.getOne.queryOptions({ palletId }),
  });

  // Fetch locations for move
  const { data: locations } = useQuery({
    ...api.wms.admin.locations.getMany.queryOptions({ locationType: 'rack' }),
    enabled: showMoveModal,
  });

  // Add case mutation
  const addCaseMutation = useMutation({
    ...api.wms.admin.pallets.addCase.mutationOptions(),
    onSuccess: (result) => {
      void queryClient.invalidateQueries();
      setLastScanResult({ success: true, message: result.message || 'Case added successfully' });
      setScanInput('');
      scanInputRef.current?.focus();
    },
    onError: (error) => {
      setLastScanResult({ success: false, message: error.message });
      setScanInput('');
      scanInputRef.current?.focus();
    },
  });

  // Remove case mutation
  const removeCaseMutation = useMutation({
    ...api.wms.admin.pallets.removeCase.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });

  // Seal pallet mutation
  const sealMutation = useMutation({
    ...api.wms.admin.pallets.seal.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });

  // Move pallet mutation
  const moveMutation = useMutation({
    ...api.wms.admin.pallets.move.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      setShowMoveModal(false);
      setSelectedLocationId(null);
    },
  });

  // Focus scan input on mount
  useEffect(() => {
    if (data?.pallet.status === 'active') {
      scanInputRef.current?.focus();
    }
  }, [data?.pallet.status]);

  // Clear scan result after 3 seconds
  useEffect(() => {
    if (lastScanResult) {
      const timer = setTimeout(() => setLastScanResult(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastScanResult]);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    addCaseMutation.mutate({ palletId, caseBarcode: scanInput.trim() });
  };

  const handlePrintLabel = async () => {
    try {
      const result = await trpcClient.wms.admin.pallets.getLabel.query({ palletId });
      downloadZplFile(result.zpl, result.palletCode);
    } catch (error) {
      console.error('Failed to generate label:', error);
    }
  };

  const handleMove = () => {
    if (!selectedLocationId) return;
    moveMutation.mutate({ palletId, toLocationId: selectedLocationId });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      sealed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      retrieved: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    };
    return (
      <span className={`rounded px-2 py-1 text-sm font-medium ${colors[status] || 'bg-fill-secondary text-text-muted'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Icon icon={IconLoader2} className="animate-spin" size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-6">
        <Typography variant="headingMd">Pallet not found</Typography>
      </div>
    );
  }

  const { pallet, cases, productSummary, totalCases } = data;
  const canAddCases = pallet.status === 'active';
  const canSeal = pallet.status === 'active' && totalCases > 0;
  const canMove = pallet.status === 'sealed' || pallet.status === 'active';

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/platform/admin/wms/pallets">
            <Button variant="ghost" size="sm">
              <Icon icon={IconArrowLeft} size="sm" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Typography variant="headingMd">{pallet.palletCode}</Typography>
              {getStatusBadge(pallet.status ?? 'active')}
            </div>
            <Typography variant="bodySm" colorRole="muted">
              {pallet.ownerName}
              {pallet.locationCode && ` • ${pallet.locationCode}`}
            </Typography>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg">{totalCases}</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Cases
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg">{productSummary.length}</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Products
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg">
                {pallet.locationCode || '-'}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Location
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* Scan Input (Active pallets only) */}
        {canAddCases && (
          <Card>
            <CardContent className="p-4">
              <form onSubmit={handleScan} className="space-y-3">
                <Typography variant="headingSm">Scan Case Barcode</Typography>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Icon
                      icon={IconScan}
                      size="sm"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                    <input
                      ref={scanInputRef}
                      type="text"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      placeholder="Scan or enter case barcode..."
                      className="w-full rounded-lg border border-border-primary bg-fill-primary py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      inputMode="none"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="default"
                    disabled={!scanInput.trim() || addCaseMutation.isPending}
                  >
                    <ButtonContent iconLeft={addCaseMutation.isPending ? IconLoader2 : IconCheck}>
                      Add
                    </ButtonContent>
                  </Button>
                </div>
                {lastScanResult && (
                  <div
                    className={`rounded-lg p-3 text-sm ${
                      lastScanResult.success
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                    }`}
                  >
                    {lastScanResult.message}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {canSeal && (
            <Button
              variant="default"
              onClick={() => sealMutation.mutate({ palletId })}
              disabled={sealMutation.isPending}
            >
              <ButtonContent iconLeft={sealMutation.isPending ? IconLoader2 : IconLock}>
                Seal Pallet
              </ButtonContent>
            </Button>
          )}
          {canMove && (
            <Button variant="outline" onClick={() => setShowMoveModal(true)}>
              <ButtonContent iconLeft={IconMapPin}>Move to Location</ButtonContent>
            </Button>
          )}
          {totalCases > 0 && (
            <Button variant="outline" onClick={handlePrintLabel}>
              <ButtonContent iconLeft={IconDownload}>Print Label</ButtonContent>
            </Button>
          )}
          <Button variant="outline" onClick={() => refetch()}>
            <Icon icon={IconLoader2} size="sm" />
          </Button>
        </div>

        {/* Product Summary */}
        <Card>
          <CardContent className="p-4">
            <Typography variant="headingSm" className="mb-4">
              Contents Summary
            </Typography>
            {productSummary.length === 0 ? (
              <div className="py-8 text-center">
                <Icon icon={IconBox} size="lg" colorRole="muted" className="mx-auto mb-2" />
                <Typography variant="bodySm" colorRole="muted">
                  No cases added yet
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Scan case barcodes to add them to this pallet
                </Typography>
              </div>
            ) : (
              <div className="space-y-2">
                {productSummary.map((product) => (
                  <div
                    key={product.lwin18}
                    className="flex items-center justify-between rounded-lg bg-fill-secondary p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <Typography variant="bodySm" className="font-medium truncate">
                        {product.productName}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        {product.lwin18}
                      </Typography>
                    </div>
                    <Typography variant="headingSm" className="ml-4">
                      {product.quantity}x
                    </Typography>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Individual Cases */}
        {cases.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <Typography variant="headingSm" className="mb-4">
                All Cases ({cases.length})
              </Typography>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {cases.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg bg-fill-secondary p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <Typography variant="bodySm" className="font-medium truncate">
                        {c.productName}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        {c.caseLabelId ? `Case ${c.caseLabelId.slice(-8)}` : c.lwin18}
                      </Typography>
                    </div>
                    {canAddCases && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          removeCaseMutation.mutate({
                            palletId,
                            caseId: c.id,
                          })
                        }
                        disabled={removeCaseMutation.isPending}
                      >
                        <Icon
                          icon={removeCaseMutation.isPending ? IconLoader2 : IconTrash}
                          size="sm"
                          className={removeCaseMutation.isPending ? 'animate-spin' : 'text-red-500'}
                        />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pallet Info */}
        <Card>
          <CardContent className="p-4">
            <Typography variant="headingSm" className="mb-2">
              Pallet Info
            </Typography>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Barcode:</span>
                <span className="font-mono">{pallet.barcode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Storage Type:</span>
                <span>{pallet.storageType || 'customer_storage'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Created:</span>
                <span>{new Date(pallet.createdAt).toLocaleString()}</span>
              </div>
              {pallet.sealedAt && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Sealed:</span>
                  <span>{new Date(pallet.sealedAt).toLocaleString()}</span>
                </div>
              )}
              {pallet.notes && (
                <div className="mt-2 pt-2 border-t border-border-primary">
                  <span className="text-text-muted">Notes:</span>
                  <p className="mt-1">{pallet.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Move Modal */}
      {showMoveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowMoveModal(false)}
        >
          <Card
            className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-4 border-b border-border-primary">
              <div className="flex items-center justify-between">
                <Typography variant="headingSm">Move Pallet to Location</Typography>
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowMoveModal(false)}>
                  <Icon icon={IconX} size="sm" />
                </Button>
              </div>
            </CardContent>
            <div className="flex-1 overflow-y-auto p-4">
              {!locations?.length ? (
                <Typography variant="bodySm" colorRole="muted" className="text-center py-8">
                  No locations available
                </Typography>
              ) : (
                <div className="space-y-2">
                  {locations.map((location) => {
                    const isSelected = selectedLocationId === location.id;
                    const isCurrent = location.id === pallet.locationId;
                    return (
                      <button
                        key={location.id}
                        onClick={() => !isCurrent && setSelectedLocationId(location.id)}
                        disabled={isCurrent}
                        className={`w-full rounded-lg p-3 text-left transition-colors ${
                          isCurrent
                            ? 'bg-fill-secondary opacity-50 cursor-not-allowed'
                            : isSelected
                              ? 'bg-brand-100 border-2 border-brand-500 dark:bg-brand-900/30'
                              : 'bg-fill-secondary hover:bg-fill-secondary/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <Typography variant="bodySm" className="font-medium">
                              {location.locationCode}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              {location.locationType}
                              {location.requiresForklift && ' • Forklift'}
                            </Typography>
                          </div>
                          {isCurrent ? (
                            <span className="text-xs text-text-muted">Current</span>
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
                <Button variant="outline" className="flex-1" type="button" onClick={() => setShowMoveModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={handleMove}
                  disabled={!selectedLocationId || moveMutation.isPending}
                >
                  <ButtonContent iconLeft={moveMutation.isPending ? IconLoader2 : IconMapPin}>
                    {moveMutation.isPending ? 'Moving...' : 'Move Pallet'}
                  </ButtonContent>
                </Button>
              </div>
              {moveMutation.isError && (
                <Typography variant="bodyXs" className="mt-2 text-center text-red-600">
                  {moveMutation.error?.message}
                </Typography>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WMSPalletDetailPage;
