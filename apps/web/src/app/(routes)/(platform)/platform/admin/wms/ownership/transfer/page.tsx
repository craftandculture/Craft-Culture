'use client';

import {
  IconArrowRight,
  IconCheck,
  IconChevronRight,
  IconLoader2,
  IconMinus,
  IconPlus,
  IconSearch,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import LocationBadge from '@/app/_wms/components/LocationBadge';
import OwnerBadge from '@/app/_wms/components/OwnerBadge';
import useTRPC from '@/lib/trpc/browser';

type WorkflowStep = 'select-stock' | 'select-owner' | 'configure' | 'confirm' | 'success';

interface StockItem {
  id: string;
  lwin18: string;
  productName: string;
  ownerName: string;
  ownerId: string;
  quantityCases: number;
  availableCases: number;
  locationCode: string;
  salesArrangement?: string | null;
}

interface Partner {
  id: string;
  name: string;
}

/**
 * WMS Ownership Transfer - Transfer stock ownership from one partner to another
 */
const WMSOwnershipTransferPage = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WorkflowStep>('select-stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [selectedNewOwner, setSelectedNewOwner] = useState<Partner | null>(null);
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [salesArrangement, setSalesArrangement] = useState<'consignment' | 'purchased'>('consignment');
  const [commissionPercent, setCommissionPercent] = useState(15);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>('');
  const [lastSuccess, setLastSuccess] = useState<{
    productName: string;
    quantity: number;
    fromOwner: string;
    toOwner: string;
  } | null>(null);

  // Search stock
  const { data: stockData, isLoading: stockLoading } = useQuery({
    ...api.wms.admin.stock.search.queryOptions({
      search: searchQuery,
      limit: 20,
    }),
    enabled: step === 'select-stock' && searchQuery.length > 1,
  });

  // Get partners for new owner selection
  const { data: partnersData } = useQuery({
    ...api.partners.list.queryOptions({}),
    enabled: step === 'select-owner',
  });

  // Transfer mutation
  const transferMutation = useMutation({
    ...api.wms.admin.ownership.transfer.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      setLastSuccess({
        productName: selectedStock?.productName ?? '',
        quantity: transferQuantity,
        fromOwner: selectedStock?.ownerName ?? '',
        toOwner: selectedNewOwner?.name ?? '',
      });
      setStep('success');
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSelectStock = (stock: StockItem) => {
    setSelectedStock(stock);
    setTransferQuantity(Math.min(1, stock.availableCases));
    setSalesArrangement(stock.salesArrangement === 'purchased' ? 'purchased' : 'consignment');
    setStep('select-owner');
  };

  const handleSelectOwner = (partner: Partner) => {
    if (partner.id === selectedStock?.ownerId) {
      setError('Cannot transfer to the same owner');
      return;
    }
    setSelectedNewOwner(partner);
    setStep('configure');
  };

  const handleConfirm = () => {
    if (!selectedStock || !selectedNewOwner) return;

    transferMutation.mutate({
      stockId: selectedStock.id,
      newOwnerId: selectedNewOwner.id,
      quantityCases: transferQuantity,
      salesArrangement,
      consignmentCommissionPercent: salesArrangement === 'consignment' ? commissionPercent : undefined,
      notes: notes || undefined,
    });
  };

  const handleReset = () => {
    setStep('select-stock');
    setSearchQuery('');
    setSelectedStock(null);
    setSelectedNewOwner(null);
    setTransferQuantity(1);
    setSalesArrangement('consignment');
    setCommissionPercent(15);
    setNotes('');
    setError('');
    setLastSuccess(null);
  };

  const adjustQuantity = (delta: number) => {
    if (!selectedStock) return;
    const newQty = Math.max(1, Math.min(selectedStock.availableCases, transferQuantity + delta));
    setTransferQuantity(newQty);
  };

  return (
    <div className="container mx-auto max-w-lg px-4 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Link href="/platform/admin/wms" className="text-text-muted hover:text-text-primary">
              <Typography variant="bodySm">WMS</Typography>
            </Link>
            <IconChevronRight className="h-4 w-4 text-text-muted" />
            <Typography variant="bodySm">Ownership Transfer</Typography>
          </div>
          <Typography variant="headingLg" className="mb-1">
            Transfer Ownership
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            Transfer stock ownership from one partner to another
          </Typography>
        </div>

        {/* Step: Select Stock */}
        {step === 'select-stock' && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-6 text-center">
                <Icon icon={IconSearch} size="xl" colorRole="muted" className="mx-auto mb-2" />
                <Typography variant="headingSm">Search Stock</Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Search for the stock you want to transfer ownership of
                </Typography>
              </div>

              <div className="relative mb-4">
                <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search products, LWIN, owner..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-border-primary bg-fill-primary py-3 pl-10 pr-4 text-sm focus:border-border-brand focus:outline-none focus:ring-1 focus:ring-border-brand"
                  autoFocus
                />
              </div>

              {stockLoading && (
                <div className="flex items-center justify-center p-4">
                  <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" />
                </div>
              )}

              {!stockLoading && stockData && stockData.results.length > 0 && (
                <div className="space-y-2">
                  {stockData.results.map((stock) => (
                    <button
                      key={stock.id}
                      onClick={() =>
                        handleSelectStock({
                          id: stock.id,
                          lwin18: stock.lwin18,
                          productName: stock.productName,
                          ownerName: stock.ownerName,
                          ownerId: stock.ownerId,
                          quantityCases: stock.quantityCases,
                          availableCases: stock.availableCases,
                          locationCode: stock.locationCode,
                          salesArrangement: stock.salesArrangement,
                        })
                      }
                      className="w-full rounded-lg border border-border-primary bg-fill-primary p-3 text-left transition-colors hover:border-border-brand"
                    >
                      <Typography variant="bodySm" className="font-medium">
                        {stock.productName}
                      </Typography>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <OwnerBadge ownerName={stock.ownerName} size="sm" />
                        <LocationBadge locationCode={stock.locationCode} size="sm" />
                        <Typography variant="bodyXs" className="text-blue-600">
                          {stock.availableCases} available
                        </Typography>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!stockLoading && searchQuery.length > 1 && stockData?.results.length === 0 && (
                <Typography variant="bodyXs" colorRole="muted" className="text-center">
                  No stock found matching &ldquo;{searchQuery}&rdquo;
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Select New Owner */}
        {step === 'select-owner' && selectedStock && (
          <div className="space-y-4">
            {/* Selected Stock Info */}
            <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <IconCheck className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <Typography variant="headingSm">{selectedStock.productName}</Typography>
                    <div className="mt-1 flex items-center gap-2">
                      <Typography variant="bodyXs" colorRole="muted">
                        Current owner:
                      </Typography>
                      <OwnerBadge ownerName={selectedStock.ownerName} size="sm" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Select New Owner */}
            <Card>
              <CardContent className="p-4">
                <Typography variant="headingSm" className="mb-4">
                  Select New Owner
                </Typography>

                <div className="space-y-2">
                  {partnersData?.map((partner) => (
                    <button
                      key={partner.id}
                      onClick={() => handleSelectOwner({ id: partner.id, name: partner.name })}
                      disabled={partner.id === selectedStock.ownerId}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        partner.id === selectedStock.ownerId
                          ? 'cursor-not-allowed border-border-primary bg-fill-secondary opacity-50'
                          : 'border-border-primary bg-fill-primary hover:border-border-brand'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <OwnerBadge ownerName={partner.name} />
                        {partner.id === selectedStock.ownerId && (
                          <Typography variant="bodyXs" colorRole="muted">
                            Current owner
                          </Typography>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {error && (
                  <Typography variant="bodyXs" className="mt-2 text-red-600">
                    {error}
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Button variant="outline" className="w-full" onClick={handleReset}>
              <ButtonContent iconLeft={IconX}>Cancel</ButtonContent>
            </Button>
          </div>
        )}

        {/* Step: Configure Transfer */}
        {step === 'configure' && selectedStock && selectedNewOwner && (
          <div className="space-y-4">
            {/* Transfer Summary */}
            <Card className="bg-fill-secondary">
              <CardContent className="p-4">
                <Typography variant="headingSm" className="mb-2">
                  {selectedStock.productName}
                </Typography>
                <div className="flex items-center gap-2">
                  <OwnerBadge ownerName={selectedStock.ownerName} size="sm" />
                  <IconArrowRight className="h-4 w-4 text-text-muted" />
                  <OwnerBadge ownerName={selectedNewOwner.name} size="sm" />
                </div>
              </CardContent>
            </Card>

            {/* Quantity Selector */}
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodySm" className="mb-3 text-center">
                  Quantity to transfer
                </Typography>
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => adjustQuantity(-1)}
                    disabled={transferQuantity <= 1}
                  >
                    <Icon icon={IconMinus} />
                  </Button>
                  <div className="min-w-[80px] text-center">
                    <Typography variant="headingLg">{transferQuantity}</Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      of {selectedStock.availableCases}
                    </Typography>
                  </div>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => adjustQuantity(1)}
                    disabled={transferQuantity >= selectedStock.availableCases}
                  >
                    <Icon icon={IconPlus} />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sales Arrangement */}
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodySm" className="mb-3">
                  Sales Arrangement
                </Typography>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSalesArrangement('consignment')}
                    className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                      salesArrangement === 'consignment'
                        ? 'border-border-brand bg-blue-50 dark:bg-blue-900/20'
                        : 'border-border-primary bg-fill-primary'
                    }`}
                  >
                    <Typography variant="bodySm" className="font-medium">
                      Consignment
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      C&C sells on behalf, takes commission
                    </Typography>
                  </button>
                  <button
                    onClick={() => setSalesArrangement('purchased')}
                    className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                      salesArrangement === 'purchased'
                        ? 'border-border-brand bg-blue-50 dark:bg-blue-900/20'
                        : 'border-border-primary bg-fill-primary'
                    }`}
                  >
                    <Typography variant="bodySm" className="font-medium">
                      Purchased
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Full ownership transfer
                    </Typography>
                  </button>
                </div>

                {salesArrangement === 'consignment' && (
                  <div className="mt-4">
                    <label className="mb-1 block text-sm font-medium">Commission %</label>
                    <input
                      type="number"
                      value={commissionPercent}
                      onChange={(e) => setCommissionPercent(Number(e.target.value))}
                      min={0}
                      max={100}
                      className="w-full rounded-lg border border-border-primary bg-fill-primary p-2 text-sm focus:border-border-brand focus:outline-none focus:ring-1 focus:ring-border-brand"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardContent className="p-4">
                <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reason for transfer..."
                  rows={2}
                  className="w-full rounded-lg border border-border-primary bg-fill-primary p-2 text-sm focus:border-border-brand focus:outline-none focus:ring-1 focus:ring-border-brand"
                />
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep('select-owner')}>
                <ButtonContent iconLeft={IconX}>Back</ButtonContent>
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => setStep('confirm')}>
                <ButtonContent iconRight={IconArrowRight}>Continue</ButtonContent>
              </Button>
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && selectedStock && selectedNewOwner && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="mb-6 text-center">
                  <Typography variant="headingSm">Confirm Transfer</Typography>
                </div>

                <div className="space-y-4">
                  {/* Product */}
                  <div className="rounded-lg bg-fill-secondary p-4 text-center">
                    <Typography variant="headingSm">{selectedStock.productName}</Typography>
                    <Typography variant="headingLg" className="text-blue-600">
                      {transferQuantity} {transferQuantity === 1 ? 'case' : 'cases'}
                    </Typography>
                  </div>

                  {/* From/To */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 text-center">
                      <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                        From
                      </Typography>
                      <OwnerBadge ownerName={selectedStock.ownerName} />
                    </div>
                    <Icon icon={IconArrowRight} size="lg" colorRole="muted" />
                    <div className="flex-1 text-center">
                      <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                        To
                      </Typography>
                      <OwnerBadge ownerName={selectedNewOwner.name} />
                    </div>
                  </div>

                  {/* Arrangement */}
                  <div className="rounded-lg bg-fill-secondary p-3 text-center">
                    <Typography variant="bodyXs" colorRole="muted">
                      {salesArrangement === 'consignment'
                        ? `Consignment (${commissionPercent}% commission)`
                        : 'Purchased (full ownership)'}
                    </Typography>
                  </div>

                  {notes && (
                    <Typography variant="bodyXs" colorRole="muted" className="italic">
                      Note: {notes}
                    </Typography>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep('configure')}>
                <ButtonContent iconLeft={IconX}>Back</ButtonContent>
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleConfirm}
                disabled={transferMutation.isPending}
              >
                <ButtonContent iconLeft={transferMutation.isPending ? IconLoader2 : IconCheck}>
                  {transferMutation.isPending ? 'Transferring...' : 'Confirm Transfer'}
                </ButtonContent>
              </Button>
            </div>

            {error && (
              <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                <CardContent className="p-4">
                  <Typography variant="bodySm" className="text-red-600 dark:text-red-400">
                    {error}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && lastSuccess && (
          <div className="space-y-4">
            <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <IconCheck className="h-8 w-8" />
                </div>
                <Typography variant="headingMd" className="mb-2">
                  Transfer Complete
                </Typography>
                <Typography variant="bodySm" colorRole="muted">
                  {lastSuccess.quantity} {lastSuccess.quantity === 1 ? 'case' : 'cases'} of
                </Typography>
                <Typography variant="bodySm" className="font-medium">
                  {lastSuccess.productName}
                </Typography>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <OwnerBadge ownerName={lastSuccess.fromOwner} size="sm" />
                  <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
                  <OwnerBadge ownerName={lastSuccess.toOwner} size="sm" />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/platform/admin/wms">Done</Link>
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleReset}>
                <ButtonContent iconLeft={IconUser}>Transfer More</ButtonContent>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WMSOwnershipTransferPage;
