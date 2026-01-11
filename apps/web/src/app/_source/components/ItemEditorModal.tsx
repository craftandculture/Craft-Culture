'use client';

import {
  IconCheck,
  IconCopy,
  IconLoader2,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import formatLwin18, { formatCaseConfig as formatCaseConfigDisplay } from '../utils/formatLwin18';

// Common bottle sizes for edit mode select
const BOTTLE_SIZES = [
  { value: '750ml', label: '750ml (Standard)' },
  { value: '375ml', label: '375ml (Half)' },
  { value: '1.5L', label: '1.5L (Magnum)' },
  { value: '3L', label: '3L (Jeroboam)' },
  { value: '6L', label: '6L (Imperial)' },
];

// Common case configurations for edit mode select
const CASE_CONFIGS = [
  { value: 1, label: '1 bottle' },
  { value: 3, label: '3 bottles' },
  { value: 6, label: '6 bottles' },
  { value: 12, label: '12 bottles' },
  { value: 24, label: '24 bottles' },
];

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

  // Compute LWIN-18 and case config display for view mode
  const lwin18 = formatLwin18({
    lwin: item.lwin,
    vintage: item.vintage,
    bottleSize: item.bottleSize,
    caseConfig: item.caseConfig,
  });

  const caseConfigStr = formatCaseConfigDisplay({
    caseConfig: item.caseConfig,
    bottleSize: item.bottleSize,
  });

  const handleCopyLwin = () => {
    if (lwin18) {
      void navigator.clipboard.writeText(lwin18);
      toast.success('LWIN copied to clipboard');
    }
  };

  // VIEW MODE - Clean, readable display
  if (!canEdit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pb-0">
            <DialogTitle className="text-lg">Item Details</DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {/* Product Name - Hero Section */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-4">
              <Typography variant="headingSm" className="text-text-primary leading-tight">
                {item.productName || 'Unnamed Product'}
              </Typography>

              {/* LWIN Row */}
              {lwin18 && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-950 rounded-lg px-3 py-1.5 border border-border-muted">
                    <span className="text-xs text-text-muted font-medium">LWIN-18</span>
                    <span className="font-mono text-sm text-text-primary tracking-wide">
                      {lwin18}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyLwin}
                    className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Copy LWIN"
                  >
                    <IconCopy className="h-4 w-4 text-text-muted" />
                  </button>
                  {caseConfigStr && (
                    <span className="text-sm text-text-muted font-medium px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">
                      {caseConfigStr}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Key Metrics - Compact Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900">
                <Typography variant="headingMd" className="text-blue-700 dark:text-blue-300">
                  {item.quantity || '—'}
                </Typography>
                <Typography variant="bodyXs" className="text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                  cases
                </Typography>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-100 dark:border-purple-900">
                <Typography variant="headingMd" className="text-purple-700 dark:text-purple-300">
                  {item.vintage || 'NV'}
                </Typography>
                <Typography variant="bodyXs" className="text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                  vintage
                </Typography>
              </div>
              <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-100 dark:border-emerald-900">
                <Typography variant="headingMd" className="text-emerald-700 dark:text-emerald-300 text-sm">
                  {caseConfigStr || '6x75cl'}
                </Typography>
                <Typography variant="bodyXs" className="text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                  format
                </Typography>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <span className="text-text-muted text-xs uppercase tracking-wide">Producer</span>
                <p className="text-text-primary mt-0.5">{item.producer || '—'}</p>
              </div>
              <div>
                <span className="text-text-muted text-xs uppercase tracking-wide">Country</span>
                <p className="text-text-primary mt-0.5">{item.country || '—'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-text-muted text-xs uppercase tracking-wide">Region</span>
                <p className="text-text-primary mt-0.5">{item.region || '—'}</p>
              </div>
            </div>

            {/* Admin Notes */}
            {item.adminNotes && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium uppercase tracking-wide">
                  Admin Notes
                </span>
                <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                  {item.adminNotes}
                </p>
              </div>
            )}

            {/* Original Input - Collapsible feel */}
            {item.originalText && (
              <div className="border-t border-border-muted pt-3">
                <span className="text-xs text-text-muted uppercase tracking-wide">
                  Original Input
                </span>
                <div className="mt-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2 border border-border-muted">
                  <code className="text-xs text-text-muted break-all">
                    {item.originalText}
                  </code>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-3 border-t border-border-muted">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
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
