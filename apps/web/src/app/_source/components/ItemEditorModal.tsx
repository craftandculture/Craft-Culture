'use client';

import {
  IconCheck,
  IconLoader2,
  IconPackage,
  IconSearch,
  IconTrash,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Display field component for view mode - shows label and value in a clean format
 */
const DisplayField = ({
  label,
  value,
  mono = false,
  className = '',
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  className?: string;
}) => (
  <div className={className}>
    <Typography variant="bodySm" className="text-text-muted mb-0.5">
      {label}
    </Typography>
    <Typography
      variant="bodyMd"
      className={`text-text-primary ${mono ? 'font-mono' : ''} ${!value ? 'text-text-muted italic' : ''}`}
    >
      {value || '—'}
    </Typography>
  </div>
);

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

/**
 * Format bottle size for display
 */
const formatBottleSize = (size: string | null | undefined) => {
  if (!size) return null;
  const found = BOTTLE_SIZES.find((s) => s.value === size);
  return found ? found.label : size;
};

/**
 * Format case config for display
 */
const formatCaseConfig = (config: number | null | undefined) => {
  if (!config) return null;
  const found = CASE_CONFIGS.find((c) => c.value === config);
  return found ? found.label : `${config} bottles`;
};

export interface ItemData {
  id: string;
  productName: string | null;
  producer: string | null;
  vintage: string | null;
  region: string | null;
  country: string | null;
  bottleSize: string | null;
  caseConfig: number | null;
  lwin: string | null;
  quantity: number | null;
  adminNotes: string | null;
  originalText: string | null;
}

export interface ItemEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemData | null;
  rfqId: string;
  canEdit: boolean;
  canDelete: boolean;
  onSuccess: () => void;
}

/**
 * Modal for editing or viewing RFQ item details
 */
const ItemEditorModal = ({
  open,
  onOpenChange,
  item,
  rfqId: _rfqId,
  canEdit,
  canDelete,
  onSuccess,
}: ItemEditorModalProps) => {
  const api = useTRPC();
  // rfqId is available for future use (e.g., logging, validation)
  void _rfqId;

  // Form state
  const [productName, setProductName] = useState('');
  const [producer, setProducer] = useState('');
  const [vintage, setVintage] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');
  const [bottleSize, setBottleSize] = useState('');
  const [caseConfig, setCaseConfig] = useState<number | ''>('');
  const [lwin, setLwin] = useState('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [adminNotes, setAdminNotes] = useState('');

  // LWIN search state
  const [lwinSearchQuery, setLwinSearchQuery] = useState('');
  const [showLwinResults, setShowLwinResults] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // LWIN search query
  const { data: lwinResults, isFetching: isSearchingLwin } = useQuery({
    ...api.source.admin.searchLwin.queryOptions({
      query: lwinSearchQuery,
      limit: 8,
    }),
    enabled: lwinSearchQuery.length >= 2,
  });

  // Update mutation
  const { mutate: updateItem, isPending: isUpdating } = useMutation(
    api.source.admin.updateItem.mutationOptions({
      onSuccess: () => {
        onSuccess();
        onOpenChange(false);
      },
    }),
  );

  // Delete mutation
  const { mutate: deleteItem, isPending: isDeleting } = useMutation(
    api.source.admin.deleteItem.mutationOptions({
      onSuccess: () => {
        onSuccess();
        onOpenChange(false);
      },
    }),
  );

  // Populate form when item changes
  useEffect(() => {
    if (item) {
      setProductName(item.productName || '');
      setProducer(item.producer || '');
      setVintage(item.vintage || '');
      setRegion(item.region || '');
      setCountry(item.country || '');
      setBottleSize(item.bottleSize || '');
      setCaseConfig(item.caseConfig || '');
      setLwin(item.lwin || '');
      setQuantity(item.quantity || 1);
      setAdminNotes(item.adminNotes || '');
      setLwinSearchQuery('');
      setShowLwinResults(false);
      setShowDeleteConfirm(false);
    }
  }, [item]);

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
    if (!item || !productName.trim()) return;

    updateItem({
      itemId: item.id,
      productName: productName.trim(),
      producer: producer.trim() || undefined,
      vintage: vintage.trim() || undefined,
      region: region.trim() || undefined,
      country: country.trim() || undefined,
      bottleSize: bottleSize || undefined,
      caseConfig: caseConfig ? Number(caseConfig) : undefined,
      lwin: lwin.trim() || undefined,
      quantity: quantity ? Number(quantity) : undefined,
      adminNotes: adminNotes.trim() || undefined,
    });
  };

  // Handle delete
  const handleDelete = () => {
    if (!item) return;
    deleteItem({ itemId: item.id });
  };

  if (!item) return null;

  // VIEW MODE - Clean, readable display
  if (!canEdit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Item Details</DialogTitle>
            <DialogDescription>
              RFQ line item information
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-5">
            {/* Product Header */}
            <div className="pb-4 border-b border-border-muted">
              <Typography variant="headingSm" className="text-text-primary mb-1">
                {item.productName || 'Unnamed Product'}
              </Typography>
              {item.lwin && (
                <Typography variant="bodySm" className="text-text-muted font-mono">
                  LWIN: {item.lwin}
                </Typography>
              )}
            </div>

            {/* Key Info Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-fill-muted/50 rounded-lg p-3 text-center">
                <Typography variant="bodyXs" className="text-text-muted uppercase tracking-wide mb-1">
                  Quantity
                </Typography>
                <Typography variant="headingMd" className="text-text-primary">
                  {item.quantity || '—'}
                </Typography>
                <Typography variant="bodyXs" className="text-text-muted">
                  cases
                </Typography>
              </div>
              <div className="bg-fill-muted/50 rounded-lg p-3 text-center">
                <Typography variant="bodyXs" className="text-text-muted uppercase tracking-wide mb-1">
                  Vintage
                </Typography>
                <Typography variant="headingMd" className="text-text-primary">
                  {item.vintage || 'NV'}
                </Typography>
              </div>
              <div className="bg-fill-muted/50 rounded-lg p-3 text-center">
                <Typography variant="bodyXs" className="text-text-muted uppercase tracking-wide mb-1">
                  Format
                </Typography>
                <Typography variant="headingMd" className="text-text-primary text-sm">
                  {item.caseConfig ? `${item.caseConfig}x` : '—'}
                </Typography>
                <Typography variant="bodyXs" className="text-text-muted">
                  {formatBottleSize(item.bottleSize) || '750ml'}
                </Typography>
              </div>
            </div>

            {/* Producer & Origin Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-text-muted">
                <IconUser className="h-4 w-4" />
                <Typography variant="bodySm" className="font-medium">
                  Producer & Origin
                </Typography>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 pl-6">
                <DisplayField label="Producer" value={item.producer} />
                <DisplayField label="Country" value={item.country} />
                <DisplayField label="Region" value={item.region} className="col-span-2" />
              </div>
            </div>

            {/* Packaging Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-text-muted">
                <IconPackage className="h-4 w-4" />
                <Typography variant="bodySm" className="font-medium">
                  Packaging
                </Typography>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 pl-6">
                <DisplayField label="Bottle Size" value={formatBottleSize(item.bottleSize)} />
                <DisplayField label="Case Configuration" value={formatCaseConfig(item.caseConfig)} />
              </div>
            </div>

            {/* Admin Notes */}
            {item.adminNotes && (
              <div className="space-y-2">
                <Typography variant="bodySm" className="text-text-muted font-medium">
                  Admin Notes
                </Typography>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <Typography variant="bodySm" className="text-amber-800 dark:text-amber-200">
                    {item.adminNotes}
                  </Typography>
                </div>
              </div>
            )}

            {/* Original Input */}
            {item.originalText && (
              <div className="space-y-2 pt-2 border-t border-border-muted">
                <Typography variant="bodyXs" className="text-text-muted uppercase tracking-wide">
                  Original Input
                </Typography>
                <div className="bg-surface-secondary rounded-lg p-3">
                  <Typography variant="bodySm" className="text-text-muted font-mono text-xs break-all">
                    {item.originalText}
                  </Typography>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t border-border-muted">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <ButtonContent>Close</ButtonContent>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // EDIT MODE - Form with inputs
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>
            Update the details for this RFQ line item.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* LWIN Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-text-primary mb-1">
              Search LWIN Database
            </label>
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search wines by name..."
                value={lwinSearchQuery}
                onChange={(e) => {
                  setLwinSearchQuery(e.target.value);
                  setShowLwinResults(true);
                }}
                onFocus={() => setShowLwinResults(true)}
                className="w-full rounded-lg border border-border-primary bg-surface-primary pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {isSearchingLwin && (
                <IconLoader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted animate-spin" />
              )}
            </div>

            {/* Search Results Dropdown */}
            {showLwinResults && lwinSearchQuery.length >= 2 && lwinResults && lwinResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-surface-primary border border-border-primary rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {lwinResults.map((result) => (
                  <button
                    key={result.lwin}
                    type="button"
                    onClick={() => handleSelectLwin(result)}
                    className="w-full px-3 py-2 text-left hover:bg-fill-muted transition-colors border-b border-border-muted last:border-b-0"
                  >
                    <div className="text-sm font-medium">{result.displayName}</div>
                    <div className="text-xs text-text-muted flex items-center gap-2">
                      <span className="font-mono">{result.lwin}</span>
                      {result.producerName && <span>| {result.producerName}</span>}
                      {result.country && <span>| {result.country}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* LWIN Code Display */}
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
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || '')}
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              placeholder="Internal notes for this item..."
              rows={2}
              className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Original Text (read-only) */}
          {item.originalText && (
            <div className="pt-2 border-t border-border-muted">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                Original Input
              </label>
              <div className="bg-surface-secondary rounded-lg px-3 py-2 text-xs font-mono text-text-muted">
                {item.originalText}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border-muted">
          {canDelete && (
            <div>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <Typography variant="bodySm" className="text-red-600">
                    Delete this item?
                  </Typography>
                  <Button
                    variant="outline"
                    colorRole="danger"
                    size="sm"
                    onClick={handleDelete}
                    isDisabled={isDeleting}
                  >
                    <ButtonContent>
                      {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                    </ButtonContent>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    <ButtonContent>Cancel</ButtonContent>
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  colorRole="danger"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <ButtonContent iconLeft={IconTrash}>Delete</ButtonContent>
                </Button>
              )}
            </div>
          )}
          <div className={`flex items-center gap-2 ${!canDelete ? 'ml-auto' : ''}`}>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <ButtonContent iconLeft={IconX}>Cancel</ButtonContent>
            </Button>
            <Button
              variant="default"
              colorRole="brand"
              onClick={handleSubmit}
              isDisabled={isUpdating || !productName.trim()}
            >
              <ButtonContent iconLeft={IconCheck}>
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </ButtonContent>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ItemEditorModal;
