'use client';

import {
  IconLoader2,
  IconPlus,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import useTRPC from '@/lib/trpc/browser';

// Common bottle sizes
const BOTTLE_SIZES = [
  { value: '750ml', label: '750ml (Standard)' },
  { value: '375ml', label: '375ml (Half)' },
  { value: '1.5L', label: '1.5L (Magnum)' },
  { value: '3L', label: '3L (Jeroboam)' },
  { value: '6L', label: '6L (Imperial)' },
];

// Common case configurations
const CASE_CONFIGS = [
  { value: 1, label: '1 bottle' },
  { value: 3, label: '3 bottles' },
  { value: 6, label: '6 bottles' },
  { value: 12, label: '12 bottles' },
  { value: 24, label: '24 bottles' },
];

export interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfqId: string;
  onSuccess: () => void;
}

/**
 * Modal for adding a new item to an RFQ with LWIN search
 */
const AddItemModal = ({
  open,
  onOpenChange,
  rfqId,
  onSuccess,
}: AddItemModalProps) => {
  const api = useTRPC();

  // Form state
  const [productName, setProductName] = useState('');
  const [producer, setProducer] = useState('');
  const [vintage, setVintage] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');
  const [bottleSize, setBottleSize] = useState('');
  const [caseConfig, setCaseConfig] = useState<number | ''>('');
  const [lwin, setLwin] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [adminNotes, setAdminNotes] = useState('');

  // LWIN search state
  const [lwinSearchQuery, setLwinSearchQuery] = useState('');
  const [showLwinResults, setShowLwinResults] = useState(false);

  // Reset form
  const resetForm = () => {
    setProductName('');
    setProducer('');
    setVintage('');
    setRegion('');
    setCountry('');
    setBottleSize('');
    setCaseConfig('');
    setLwin('');
    setQuantity(1);
    setAdminNotes('');
    setLwinSearchQuery('');
    setShowLwinResults(false);
  };

  // LWIN search query
  const { data: lwinResults, isFetching: isSearchingLwin } = useQuery({
    ...api.source.admin.searchLwin.queryOptions({
      query: lwinSearchQuery,
      limit: 8,
    }),
    enabled: lwinSearchQuery.length >= 2,
  });

  // Add item mutation
  const { mutate: addItem, isPending: isAdding } = useMutation(
    api.source.admin.addItem.mutationOptions({
      onSuccess: () => {
        onSuccess();
        onOpenChange(false);
        resetForm();
      },
    }),
  );

  // Handle LWIN selection from search results
  const handleSelectLwin = (result: NonNullable<typeof lwinResults>[number]) => {
    setLwin(result.lwin);
    setProductName(result.displayName);
    if (result.producerName) setProducer(result.producerName);
    if (result.country) setCountry(result.country);
    if (result.region) setRegion(result.region);
    setShowLwinResults(false);
    setLwinSearchQuery('');
  };

  // Handle form submission
  const handleSubmit = () => {
    if (!productName.trim()) return;

    addItem({
      rfqId,
      productName: productName.trim(),
      producer: producer.trim() || undefined,
      vintage: vintage.trim() || undefined,
      region: region.trim() || undefined,
      country: country.trim() || undefined,
      bottleSize: bottleSize || undefined,
      caseConfig: caseConfig ? Number(caseConfig) : undefined,
      lwin: lwin.trim() || undefined,
      quantity: quantity || 1,
      adminNotes: adminNotes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Item</DialogTitle>
          <DialogDescription>
            Add a new item to this RFQ. Search the LWIN database or enter details manually.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* LWIN Search - Prominent */}
          <div className="relative bg-fill-brand/5 border border-border-brand rounded-lg p-4">
            <label className="block text-sm font-semibold text-text-brand mb-2">
              Search LWIN Database
            </label>
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder="Start typing wine name to search 208k+ wines..."
                value={lwinSearchQuery}
                onChange={(e) => {
                  setLwinSearchQuery(e.target.value);
                  setShowLwinResults(true);
                }}
                onFocus={() => setShowLwinResults(true)}
                className="w-full rounded-lg border border-border-brand bg-surface-primary pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {isSearchingLwin && (
                <IconLoader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted animate-spin" />
              )}
            </div>

            {/* Search Results Dropdown */}
            {showLwinResults && lwinSearchQuery.length >= 2 && lwinResults && lwinResults.length > 0 && (
              <div className="absolute left-0 right-0 z-50 mt-1 bg-surface-primary border border-border-primary rounded-lg shadow-lg max-h-64 overflow-y-auto mx-4">
                {lwinResults.map((result) => (
                  <button
                    key={result.lwin}
                    type="button"
                    onClick={() => handleSelectLwin(result)}
                    className="w-full px-4 py-3 text-left hover:bg-fill-muted transition-colors border-b border-border-muted last:border-b-0"
                  >
                    <div className="text-sm font-medium">{result.displayName}</div>
                    <div className="text-xs text-text-muted flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="font-mono bg-fill-muted px-1.5 py-0.5 rounded">
                        {result.lwin}
                      </span>
                      {result.producerName && <span>{result.producerName}</span>}
                      {result.region && <span>| {result.region}</span>}
                      {result.country && <span>| {result.country}</span>}
                      {result.colour && (
                        <span className={`capitalize ${
                          result.colour === 'red' ? 'text-red-600' :
                          result.colour === 'white' ? 'text-amber-600' :
                          result.colour === 'rose' ? 'text-pink-600' : ''
                        }`}>
                          {result.colour}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {lwinSearchQuery.length >= 2 && lwinResults?.length === 0 && !isSearchingLwin && (
              <div className="text-xs text-text-muted mt-2">
                No wines found. Enter details manually below.
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-muted" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface-primary px-2 text-text-muted">or enter manually</span>
            </div>
          </div>

          {/* Manual Entry Form */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                LWIN Code
              </label>
              <input
                type="text"
                value={lwin}
                onChange={(e) => setLwin(e.target.value)}
                placeholder="e.g., 1012345"
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Quantity (cases) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g., Opus One 2018"
              className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm"
            />
          </div>

          {/* Producer & Vintage */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Producer
              </label>
              <input
                type="text"
                value={producer}
                onChange={(e) => setProducer(e.target.value)}
                placeholder="e.g., Opus One Winery"
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Vintage
              </label>
              <input
                type="text"
                value={vintage}
                onChange={(e) => setVintage(e.target.value)}
                placeholder="e.g., 2018, NV"
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Region & Country */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Region
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g., Napa Valley"
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Country
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g., USA"
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Bottle Size & Case Config */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Bottle Size
              </label>
              <select
                value={bottleSize}
                onChange={(e) => setBottleSize(e.target.value)}
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm"
              >
                <option value="">Select size...</option>
                {BOTTLE_SIZES.map((size) => (
                  <option key={size.value} value={size.value}>
                    {size.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Case Configuration
              </label>
              <select
                value={caseConfig}
                onChange={(e) => setCaseConfig(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm"
              >
                <option value="">Select config...</option>
                {CASE_CONFIGS.map((config) => (
                  <option key={config.value} value={config.value}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Admin Notes */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Admin Notes
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Internal notes for this item (shown to partners)..."
              rows={2}
              className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-muted">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <ButtonContent iconLeft={IconX}>Cancel</ButtonContent>
          </Button>
          <Button
            variant="default"
            colorRole="brand"
            onClick={handleSubmit}
            isDisabled={isAdding || !productName.trim()}
          >
            <ButtonContent iconLeft={IconPlus}>
              {isAdding ? 'Adding...' : 'Add Item'}
            </ButtonContent>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddItemModal;
