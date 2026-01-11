'use client';

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconBan,
  IconCheck,
  IconCircleCheck,
  IconEdit,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconFilter,
  IconFilterOff,
  IconPackageExport,
  IconPlus,
  IconSelectAll,
  IconSend,
  IconSparkles,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import AddItemModal from '@/app/_source/components/AddItemModal';
import ItemEditorModal from '@/app/_source/components/ItemEditorModal';
import type { ItemData } from '@/app/_source/components/ItemEditorModal';
import QuoteExcelUpload from '@/app/_source/components/QuoteExcelUpload';
import RfqStatusBadge from '@/app/_source/components/RfqStatusBadge';
import SendToPartnersDialog from '@/app/_source/components/SendToPartnersDialog';
import exportRfqToExcel from '@/app/_source/utils/exportRfqToExcel';
import exportRfqToPDF from '@/app/_source/utils/exportRfqToPDF';
import formatLwin18, { formatCaseConfig } from '@/app/_source/utils/formatLwin18';
import type { ParsedQuote } from '@/app/_source/utils/parseQuoteExcel';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * RFQ detail page with comparison view
 */
const RfqDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const rfqId = params.rfqId as string;
  const api = useTRPC();

  const [isSelectPartnersOpen, setIsSelectPartnersOpen] = useState(false);
  const [showUnselectedOnly, setShowUnselectedOnly] = useState(false);

  // State for editing prices
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const priceInputRef = useRef<HTMLInputElement>(null);

  // State for item modals
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemData | null>(null);

  // State for partner response upload
  const [isUploadPartnerResponseOpen, setIsUploadPartnerResponseOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [parsedPartnerQuotes, setParsedPartnerQuotes] = useState<ParsedQuote[] | null>(null);

  // State for PO generation
  const [isGeneratePOsOpen, setIsGeneratePOsOpen] = useState(false);
  const [poDeliveryAddress, setPoDeliveryAddress] = useState('');
  const [poPaymentTerms, setPoPaymentTerms] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [generatedPOs, setGeneratedPOs] = useState<Array<{
    id: string;
    poNumber: string;
    partnerName: string;
    itemCount: number;
    totalAmountUsd: number;
  }> | null>(null);

  // State for cancel/delete dialogs
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch RFQ data
  const { data: rfq, isLoading, refetch } = useQuery({
    ...api.source.admin.getOne.queryOptions({ rfqId }),
  });

  // Select quote mutation
  const { mutate: selectQuote, isPending: isSelectingQuote } = useMutation(
    api.source.admin.selectQuote.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    }),
  );

  // Generate final quote mutation (exports to PDF)
  const { mutate: generateFinalQuote, isPending: isGenerating } = useMutation(
    api.source.admin.generateFinalQuote.mutationOptions({
      onSuccess: async (data) => {
        // Export to PDF
        await exportRfqToPDF(data.rfq, data.lineItems, data.summary, data.unquotedItems);
        void refetch();
      },
    }),
  );

  // Update item mutation (for price adjustment)
  const { mutate: updateItem, isPending: isUpdatingItem } = useMutation(
    api.source.admin.updateItem.mutationOptions({
      onSuccess: () => {
        void refetch();
        setEditingItemId(null);
      },
    }),
  );

  // Bulk select mutation
  const { mutate: bulkSelectQuotes, isPending: isBulkSelecting } = useMutation(
    api.source.admin.bulkSelectQuotes.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    }),
  );

  // Auto-select best mutation (server-side for better performance)
  const { mutate: autoSelectBest, isPending: isAutoSelecting } = useMutation(
    api.source.admin.autoSelectBest.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    }),
  );

  // Submit quotes on behalf of partner mutation
  const { mutate: submitQuotesOnBehalf, isPending: isSubmittingOnBehalf } = useMutation(
    api.source.admin.submitQuotesOnBehalf.mutationOptions({
      onSuccess: () => {
        void refetch();
        setIsUploadPartnerResponseOpen(false);
        setSelectedPartnerId('');
        setParsedPartnerQuotes(null);
      },
    }),
  );

  // Generate Purchase Orders mutation
  const { mutate: generatePurchaseOrders, isPending: isGeneratingPOs } = useMutation(
    api.source.admin.generatePurchaseOrders.mutationOptions({
      onSuccess: (data) => {
        void refetch();
        setGeneratedPOs(data.purchaseOrders);
        // Clear form fields
        setPoDeliveryAddress('');
        setPoPaymentTerms('');
        setPoNotes('');
      },
    }),
  );

  // Cancel RFQ mutation
  const { mutate: cancelRfq, isPending: isCancelling } = useMutation(
    api.source.admin.cancel.mutationOptions({
      onSuccess: () => {
        void refetch();
        setIsCancelDialogOpen(false);
      },
    }),
  );

  // Delete RFQ mutation
  const { mutate: deleteRfq, isPending: isDeleting } = useMutation(
    api.source.admin.delete.mutationOptions({
      onSuccess: () => {
        router.push('/platform/admin/source');
      },
    }),
  );

  // Focus input when editing starts
  useEffect(() => {
    if (editingItemId && priceInputRef.current) {
      priceInputRef.current.focus();
      priceInputRef.current.select();
    }
  }, [editingItemId]);

  // Export comparison to Excel
  const handleExportExcel = () => {
    if (!rfq) return;
    exportRfqToExcel(rfq);
  };

  // Filtered items based on selection status (must be before early returns)
  const filteredItems = useMemo(() => {
    if (!rfq) return [];
    if (showUnselectedOnly) {
      return rfq.items.filter((i) => !i.selectedQuoteId);
    }
    return rfq.items;
  }, [rfq, showUnselectedOnly]);

  // Progress tracking (must be before early returns)
  const selectedCount = rfq?.items.filter((i) => i.selectedQuoteId).length ?? 0;
  const totalItems = rfq?.items.length ?? 0;
  const progressPercent = totalItems > 0 ? (selectedCount / totalItems) * 100 : 0;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <Typography variant="bodyMd" colorRole="muted">
          Loading RFQ...
        </Typography>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <Typography variant="bodyMd" colorRole="muted">
          RFQ not found
        </Typography>
      </div>
    );
  }

  const canSendToPartners = ['draft', 'parsing', 'ready_to_send'].includes(rfq.status);
  const canSelectQuotes = ['sent', 'collecting', 'comparing', 'selecting'].includes(rfq.status);
  const canGenerateQuote = rfq.status === 'selecting' || rfq.items.some((i) => i.selectedQuoteId);
  const canGeneratePOs = rfq.status === 'finalized';
  const hasGeneratedPOs = rfq.status === 'po_generated' || rfq.status === 'completed';
  const canDelete = ['draft', 'parsing', 'ready_to_send'].includes(rfq.status);
  const canCancel = ['sent', 'collecting', 'comparing', 'selecting', 'finalized', 'po_generated', 'quote_generated'].includes(rfq.status);
  const isCancelled = rfq.status === 'cancelled';

  // Build comparison data
  const partnerMap = new Map(rfq.partners.map((p) => [p.partnerId, p]));
  const uniquePartners = Array.from(new Set(rfq.partners.map((p) => p.partnerId))).map(
    (id) => partnerMap.get(id)!,
  );

  const handleSelectQuote = (itemId: string, quoteId: string) => {
    selectQuote({ itemId, quoteId });
  };

  // Start editing price for an item
  const handleStartEditPrice = (itemId: string, currentPrice: number) => {
    setEditingItemId(itemId);
    setEditingPrice(currentPrice.toFixed(2));
  };

  // Save edited price
  const handleSavePrice = (itemId: string) => {
    const price = parseFloat(editingPrice);
    if (isNaN(price) || price <= 0) {
      return;
    }
    updateItem({ itemId, finalPriceUsd: price });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingPrice('');
  };

  // Open item editor modal
  const handleOpenItemEditor = (item: typeof rfq.items[number]) => {
    if (!rfq) return;
    setEditingItem({
      id: item.id,
      productName: item.productName,
      producer: item.producer,
      vintage: item.vintage,
      region: item.region,
      country: item.country,
      bottleSize: item.bottleSize,
      caseConfig: item.caseConfig,
      lwin: item.lwin,
      quantity: item.quantity,
      adminNotes: item.adminNotes,
      originalText: item.originalText,
    });
    setIsItemEditorOpen(true);
  };

  // Auto-select best prices for all items (server-side)
  const handleAutoSelectBest = () => {
    if (!rfq) return;
    autoSelectBest({ rfqId, strategy: 'lowest_price' });
  };

  // Clear all selections
  const handleClearAll = () => {
    if (!rfq) return;
    bulkSelectQuotes({ rfqId, selections: [], clearAll: true });
  };

  // Select all from one partner (server-side)
  const handleSelectAllFromPartner = (partnerId: string) => {
    if (!rfq) return;
    autoSelectBest({ rfqId, strategy: 'single_partner', partnerId });
  };

  // Handle parsed quotes from Excel upload for partner
  const handlePartnerQuotesParsed = (quotes: ParsedQuote[]) => {
    setParsedPartnerQuotes(quotes);
  };

  // Submit parsed quotes on behalf of partner
  const handleSubmitOnBehalf = () => {
    if (!parsedPartnerQuotes || !selectedPartnerId) return;

    submitQuotesOnBehalf({
      rfqId,
      partnerId: selectedPartnerId,
      quotes: parsedPartnerQuotes.map((q) => ({
        itemId: q.itemId,
        quoteType: q.quoteType,
        quotedVintage: q.quotedVintage,
        costPricePerCaseUsd: q.costPricePerCaseUsd,
        currency: 'USD',
        caseConfig: q.caseConfig,
        availableQuantity: q.availableQuantity,
        leadTimeDays: q.leadTimeDays,
        stockLocation: q.stockLocation,
        notes: q.notes,
        notAvailableReason: q.notAvailableReason,
        alternativeProductName: q.alternativeProductName,
        alternativeProducer: q.alternativeProducer,
        alternativeVintage: q.alternativeVintage,
        alternativeReason: q.alternativeReason,
      })),
      partnerNotes: 'Uploaded via admin on behalf of partner',
    });
  };

  // Reset upload dialog state
  const handleCloseUploadDialog = () => {
    setIsUploadPartnerResponseOpen(false);
    setSelectedPartnerId('');
    setParsedPartnerQuotes(null);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/platform/admin/source">
              <Button variant="ghost" size="sm" aria-label="Back to RFQ list">
                <ButtonContent iconLeft={IconArrowLeft} />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Typography variant="bodyXs" className="font-mono text-text-muted">
                  {rfq.rfqNumber}
                </Typography>
                <RfqStatusBadge status={rfq.status} />
              </div>
              <Typography variant="headingLg">{rfq.name}</Typography>
              {rfq.distributorCompany && (
                <Typography variant="bodySm" colorRole="muted">
                  {rfq.distributorCompany}
                  {rfq.distributorName && ` - ${rfq.distributorName}`}
                </Typography>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canSendToPartners && (
              <Button
                variant="outline"
                onClick={() => setIsAddItemOpen(true)}
              >
                <ButtonContent iconLeft={IconPlus}>Add Item</ButtonContent>
              </Button>
            )}
            {canSendToPartners && rfq.itemCount > 0 && (
              <Button
                variant="default"
                colorRole="brand"
                onClick={() => setIsSelectPartnersOpen(true)}
              >
                <ButtonContent iconLeft={IconSend}>Send to Partners</ButtonContent>
              </Button>
            )}
            {rfq.items.length > 0 && (
              <Button
                variant="outline"
                onClick={handleExportExcel}
              >
                <ButtonContent iconLeft={IconFileSpreadsheet}>Export Excel</ButtonContent>
              </Button>
            )}
            {canGenerateQuote && (
              <Button
                variant="default"
                colorRole="brand"
                onClick={() => generateFinalQuote({ rfqId })}
                isDisabled={isGenerating}
              >
                <ButtonContent iconLeft={IconFileTypePdf}>
                  {isGenerating ? 'Generating...' : 'Export PDF'}
                </ButtonContent>
              </Button>
            )}
            {canGeneratePOs && (
              <Button
                variant="default"
                colorRole="brand"
                onClick={() => setIsGeneratePOsOpen(true)}
              >
                <ButtonContent iconLeft={IconPackageExport}>Generate POs</ButtonContent>
              </Button>
            )}
            {hasGeneratedPOs && (
              <Link href={`/platform/admin/source/${rfqId}/purchase-orders`}>
                <Button variant="outline">
                  <ButtonContent iconLeft={IconPackageExport}>View POs</ButtonContent>
                </Button>
              </Link>
            )}
            {canCancel && (
              <Button
                variant="outline"
                colorRole="danger"
                onClick={() => setIsCancelDialogOpen(true)}
              >
                <ButtonContent iconLeft={IconBan}>Cancel</ButtonContent>
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                colorRole="danger"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <ButtonContent iconLeft={IconTrash}>Delete</ButtonContent>
              </Button>
            )}
            {isCancelled && (
              <Button
                variant="outline"
                colorRole="danger"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <ButtonContent iconLeft={IconTrash}>Delete</ButtonContent>
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg">{rfq.itemCount}</Typography>
              <Typography variant="bodySm" colorRole="muted">
                Items
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg">{rfq.partnerCount}</Typography>
              <Typography variant="bodySm" colorRole="muted">
                Partners
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg">{rfq.responseCount}</Typography>
              <Typography variant="bodySm" colorRole="muted">
                Responses
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg">
                {rfq.items.filter((i) => i.selectedQuoteId).length}
              </Typography>
              <Typography variant="bodySm" colorRole="muted">
                Selected
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* Partner Response Status */}
        {rfq.partners.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <Typography variant="headingSm">
                  Partner Responses
                </Typography>
                {canSelectQuotes && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsUploadPartnerResponseOpen(true)}
                  >
                    <ButtonContent iconLeft={IconUpload}>
                      Upload Response
                    </ButtonContent>
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {rfq.partners.map((rp) => (
                  <div
                    key={rp.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                      rp.status === 'submitted'
                        ? 'border-border-success bg-fill-success/10'
                        : rp.status === 'declined'
                          ? 'border-border-danger bg-fill-danger/10'
                          : 'border-border-muted bg-fill-muted'
                    }`}
                  >
                    <span className="text-sm font-medium">{rp.partner.businessName}</span>
                    <span
                      className={`text-xs ${
                        rp.status === 'submitted'
                          ? 'text-text-success'
                          : rp.status === 'declined'
                            ? 'text-text-danger'
                            : 'text-text-muted'
                      }`}
                    >
                      {rp.status === 'submitted'
                        ? `${rp.quoteCount} quotes`
                        : rp.status === 'declined'
                          ? 'Declined'
                          : rp.status === 'viewed'
                            ? 'Viewed'
                            : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps Workflow Panel - Shows when quotes can be selected */}
        {canSelectQuotes && selectedCount > 0 && (
          <Card className="border-border-brand bg-gradient-to-r from-fill-brand/5 to-fill-brand/10">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Progress Steps */}
                <div className="flex items-center gap-2">
                  {/* Step 1: Select */}
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      selectedCount === totalItems
                        ? 'bg-fill-success text-white'
                        : 'bg-fill-brand text-white'
                    }`}>
                      {selectedCount === totalItems ? (
                        <IconCircleCheck className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-bold">1</span>
                      )}
                    </div>
                    <div className="hidden sm:block">
                      <Typography variant="bodySm" className="font-semibold">Select Quotes</Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        {selectedCount}/{totalItems} selected
                      </Typography>
                    </div>
                  </div>

                  <IconArrowRight className="w-4 h-4 text-text-muted mx-1" />

                  {/* Step 2: Finalize */}
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      rfq.status === 'finalized'
                        ? 'bg-fill-success text-white'
                        : selectedCount > 0
                          ? 'bg-fill-brand/20 text-fill-brand border-2 border-fill-brand'
                          : 'bg-fill-muted text-text-muted'
                    }`}>
                      {rfq.status === 'finalized' ? (
                        <IconCircleCheck className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-bold">2</span>
                      )}
                    </div>
                    <div className="hidden sm:block">
                      <Typography variant="bodySm" className="font-semibold">Finalize & Export</Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        Generate client quote
                      </Typography>
                    </div>
                  </div>

                  <IconArrowRight className="w-4 h-4 text-text-muted mx-1" />

                  {/* Step 3: Generate POs */}
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      hasGeneratedPOs
                        ? 'bg-fill-success text-white'
                        : rfq.status === 'finalized'
                          ? 'bg-fill-brand/20 text-fill-brand border-2 border-fill-brand'
                          : 'bg-fill-muted text-text-muted'
                    }`}>
                      {hasGeneratedPOs ? (
                        <IconCircleCheck className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-bold">3</span>
                      )}
                    </div>
                    <div className="hidden sm:block">
                      <Typography variant="bodySm" className="font-semibold">Generate POs</Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        Order from partners
                      </Typography>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex items-center gap-3">
                  {rfq.status !== 'finalized' && !hasGeneratedPOs && (
                    <>
                      <div className="text-right hidden sm:block">
                        <Typography variant="bodySm" className="font-medium text-text-brand">
                          Ready to finalize?
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {selectedCount < totalItems
                            ? `${totalItems - selectedCount} items still unselected`
                            : 'All items have quotes selected'}
                        </Typography>
                      </div>
                      <Button
                        variant="default"
                        colorRole="brand"
                        onClick={() => generateFinalQuote({ rfqId })}
                        isDisabled={isGenerating}
                      >
                        <ButtonContent iconLeft={IconFileTypePdf}>
                          {isGenerating ? 'Finalizing...' : 'Finalize & Export PDF'}
                        </ButtonContent>
                      </Button>
                    </>
                  )}
                  {rfq.status === 'finalized' && !hasGeneratedPOs && (
                    <>
                      <div className="text-right hidden sm:block">
                        <Typography variant="bodySm" className="font-medium text-text-success">
                          Quotes finalized!
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          Ready to generate purchase orders
                        </Typography>
                      </div>
                      <Button
                        variant="default"
                        colorRole="brand"
                        onClick={() => setIsGeneratePOsOpen(true)}
                      >
                        <ButtonContent iconLeft={IconPackageExport}>Generate POs</ButtonContent>
                      </Button>
                    </>
                  )}
                  {hasGeneratedPOs && (
                    <>
                      <div className="text-right hidden sm:block">
                        <Typography variant="bodySm" className="font-medium text-text-success">
                          POs generated!
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          View and manage purchase orders
                        </Typography>
                      </div>
                      <Link href={`/platform/admin/source/${rfqId}/purchase-orders`}>
                        <Button variant="default" colorRole="brand">
                          <ButtonContent iconLeft={IconPackageExport}>View POs</ButtonContent>
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Compact Comparison Table */}
        <Card>
          <CardContent className="p-0">
            {/* Header with Progress and Bulk Actions */}
            <div className="p-3 border-b border-border-muted flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4">
                <Typography variant="headingSm">Quotes</Typography>
                {/* Progress Indicator */}
                <div className="flex items-center gap-2">
                  <div className="w-16 sm:w-24 h-1.5 bg-fill-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-fill-brand rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted whitespace-nowrap">
                    {selectedCount}/{totalItems}
                  </span>
                </div>
              </div>

              {/* Bulk Actions */}
              {canSelectQuotes && (
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoSelectBest}
                    isDisabled={isBulkSelecting || isAutoSelecting}
                  >
                    <ButtonContent iconLeft={IconSparkles}>
                      <span className="hidden sm:inline">{isAutoSelecting ? 'Selecting...' : 'Auto-Select Best'}</span>
                      <span className="sm:hidden">{isAutoSelecting ? '...' : 'Auto'}</span>
                    </ButtonContent>
                  </Button>
                  {uniquePartners.length > 0 && (
                    <div className="relative group">
                      <Button variant="ghost" size="sm">
                        <ButtonContent iconLeft={IconSelectAll}>
                          <span className="hidden sm:inline">Select All From</span>
                          <span className="sm:hidden">From</span>
                        </ButtonContent>
                      </Button>
                      <div className="absolute right-0 top-full mt-1 bg-surface-primary border border-border-muted rounded-lg shadow-lg py-1 hidden group-hover:block z-10 min-w-40">
                        {uniquePartners.map((p) => (
                          <button
                            key={p.partnerId}
                            onClick={() => handleSelectAllFromPartner(p.partnerId)}
                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-fill-muted"
                          >
                            {p.partner.businessName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    isDisabled={isBulkSelecting || selectedCount === 0}
                  >
                    <ButtonContent iconLeft={IconX}>Clear</ButtonContent>
                  </Button>
                  <div className="hidden sm:block w-px h-5 bg-border-muted mx-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowUnselectedOnly(!showUnselectedOnly)}
                    className={showUnselectedOnly ? 'bg-fill-brand/10' : ''}
                  >
                    <ButtonContent iconLeft={showUnselectedOnly ? IconFilterOff : IconFilter}>
                      <span className="hidden sm:inline">{showUnselectedOnly ? 'Show All' : 'Unselected'}</span>
                    </ButtonContent>
                  </Button>
                </div>
              )}
            </div>

            {rfq.items.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-fill-brand/10 flex items-center justify-center mx-auto mb-4">
                  <IconPlus className="h-6 w-6 text-text-brand" />
                </div>
                <Typography variant="headingSm" className="mb-2">
                  No items yet
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="mb-4">
                  Add items manually or upload a spreadsheet to get started
                </Typography>
                {canSendToPartners && (
                  <Button
                    variant="default"
                    colorRole="brand"
                    onClick={() => setIsAddItemOpen(true)}
                  >
                    <ButtonContent iconLeft={IconPlus}>Add First Item</ButtonContent>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  {/* Sticky Header */}
                  <thead className="bg-fill-muted sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide min-w-[280px]">
                        Product
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-semibold text-text-muted uppercase tracking-wide w-16">
                        Format
                      </th>
                      <th className="px-2 py-2 text-center text-[10px] font-semibold text-text-muted uppercase tracking-wide w-12">
                        Qty
                      </th>
                      {uniquePartners.map((p) => (
                        <th
                          key={p.partnerId}
                          className="px-2 py-2 text-center text-[10px] font-semibold text-text-muted uppercase tracking-wide min-w-[120px]"
                        >
                          <span className="truncate block" title={p.partner.businessName}>
                            {p.partner.businessName.length > 14
                              ? `${p.partner.businessName.slice(0, 12)}...`
                              : p.partner.businessName}
                          </span>
                        </th>
                      ))}
                      <th className="px-2 py-2 text-center text-[10px] font-semibold text-text-muted uppercase tracking-wide w-24">
                        Final
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item, idx) => {
                      const selectedQuote = item.quotes.find((q) => q.quote.isSelected);

                      // Calculate min/max prices for color coding (exclude N/A quotes)
                      const quotePrices = item.quotes
                        .map((q) => q.quote.costPricePerCaseUsd)
                        .filter((p): p is number => p !== null && p > 0);
                      const minPrice = quotePrices.length > 0 ? Math.min(...quotePrices) : null;
                      const maxPrice =
                        quotePrices.length > 1 ? Math.max(...quotePrices) : null;

                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-border-muted/50 hover:bg-fill-muted/30 ${
                            idx % 2 === 0 ? 'bg-surface-primary' : 'bg-fill-muted/10'
                          }`}
                        >
                          {/* Product Cell - Name, Producer, Vintage, Region - Clickable to Edit */}
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => handleOpenItemEditor(item)}
                              className={`w-full text-left min-w-0 group ${
                                canSendToPartners ? 'cursor-pointer hover:bg-fill-brand/5 rounded px-1 -mx-1' : ''
                              }`}
                              disabled={!canSendToPartners && !canSelectQuotes}
                            >
                              <div className="flex items-baseline gap-1.5">
                                {/* Low confidence warning */}
                                {item.parseConfidence !== null && item.parseConfidence < 0.7 && (
                                  <span
                                    className="shrink-0"
                                    title={`Low parse confidence: ${Math.round(item.parseConfidence * 100)}% - click to review`}
                                  >
                                    <IconAlertTriangle className="h-3 w-3 text-text-warning" />
                                  </span>
                                )}
                                <span
                                  className="text-xs font-semibold truncate group-hover:text-text-brand transition-colors"
                                  title={item.productName || ''}
                                >
                                  {item.productName}
                                </span>
                                {item.vintage && (
                                  <span className="text-xs text-text-brand font-medium shrink-0">
                                    {item.vintage}
                                  </span>
                                )}
                                {canSendToPartners && (
                                  <IconEdit className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-muted">
                                {item.lwin && (() => {
                                  // For alt_product, use alternative bottle size; otherwise use item's
                                  const effectiveBottleSize = selectedQuote?.quote.quoteType === 'alternative'
                                    ? selectedQuote.quote.alternativeBottleSize || item.bottleSize
                                    : item.bottleSize;
                                  // For alt_product, use alternative case config; otherwise use quote's case config
                                  const effectiveCaseConfig = selectedQuote
                                    ? (selectedQuote.quote.quoteType === 'alternative'
                                        ? selectedQuote.quote.alternativeCaseConfig
                                        : selectedQuote.quote.caseConfig) || item.caseConfig
                                    : item.caseConfig;
                                  const caseConfigDisplay = formatCaseConfig({
                                    caseConfig: effectiveCaseConfig,
                                    bottleSize: effectiveBottleSize,
                                  });
                                  // For vintage: alt_vintage uses alternativeVintage, alt_product uses alternativeVintage,
                                  // exact uses quotedVintage, fallback to item.vintage
                                  const effectiveVintage = selectedQuote
                                    ? (selectedQuote.quote.quoteType === 'alternative' || selectedQuote.quote.quoteType === 'alt_vintage'
                                        ? selectedQuote.quote.alternativeVintage
                                        : selectedQuote.quote.quotedVintage) || item.vintage
                                    : item.vintage;
                                  return (
                                    <span className="font-mono bg-fill-muted px-1 rounded flex items-center gap-1.5">
                                      <span>
                                        {formatLwin18({
                                          lwin: item.lwin,
                                          vintage: effectiveVintage,
                                          bottleSize: effectiveBottleSize,
                                          caseConfig: effectiveCaseConfig,
                                        })}
                                      </span>
                                      {caseConfigDisplay && (
                                        <>
                                          <span className="text-text-muted/50">|</span>
                                          <span className="text-text-primary font-semibold">{caseConfigDisplay}</span>
                                        </>
                                      )}
                                    </span>
                                  );
                                })()}
                                {!item.lwin && item.parseConfidence !== null && item.parseConfidence >= 0.7 && (
                                  <span className="text-text-warning text-[9px]">No LWIN</span>
                                )}
                                {item.producer && <span>{item.producer}</span>}
                                {item.region && (
                                  <>
                                    {(item.producer || item.lwin) && <span>·</span>}
                                    <span>{item.region}</span>
                                  </>
                                )}
                                {item.country && !item.region && (
                                  <>
                                    {(item.producer || item.lwin) && <span>·</span>}
                                    <span>{item.country}</span>
                                  </>
                                )}
                              </div>
                            </button>
                          </td>

                          {/* Format Cell - Bottle Size & Case Config */}
                          <td className="px-2 py-2 text-center">
                            <div className="text-[10px]">
                              {item.bottleSize && (
                                <div className="font-medium">{item.bottleSize}</div>
                              )}
                              {item.caseConfig && (
                                <div className="text-text-muted">{item.caseConfig}pk</div>
                              )}
                              {!item.bottleSize && !item.caseConfig && (
                                <span className="text-text-muted">—</span>
                              )}
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="px-2 py-2 text-center">
                            <span className="text-xs font-semibold">{item.quantity}</span>
                            <span className="text-[10px] text-text-muted ml-0.5">
                              {item.quantityUnit === 'bottles' ? 'btl' : 'cs'}
                            </span>
                          </td>

                          {/* Partner Quote Cells - With Multiple Vintage Support */}
                          {uniquePartners.map((p) => {
                            // Get ALL quotes from this partner for this item (multi-vintage support)
                            const partnerQuotes = item.quotes.filter(
                              (q) => q.quote.partnerId === p.partnerId,
                            );

                            if (partnerQuotes.length === 0) {
                              return (
                                <td
                                  key={p.partnerId}
                                  className="px-1 py-2 text-center text-[10px] text-text-muted"
                                >
                                  —
                                </td>
                              );
                            }

                            // Check if any quotes are N/A (typically there would be just one N/A quote)
                            const naQuote = partnerQuotes.find((q) => q.quote.quoteType === 'not_available');
                            if (naQuote) {
                              return (
                                <td key={p.partnerId} className="px-1 py-2 text-center">
                                  <span
                                    className="text-[10px] text-text-danger bg-fill-danger/10 px-1.5 py-0.5 rounded"
                                    title={naQuote.quote.notAvailableReason || 'Not available'}
                                  >
                                    N/A
                                  </span>
                                </td>
                              );
                            }

                            // Filter to quotes with valid prices
                            const validQuotes = partnerQuotes.filter(
                              (q) => q.quote.costPricePerCaseUsd !== null && q.quote.costPricePerCaseUsd > 0,
                            );

                            if (validQuotes.length === 0) {
                              return (
                                <td
                                  key={p.partnerId}
                                  className="px-1 py-2 text-center text-[10px] text-text-muted"
                                >
                                  —
                                </td>
                              );
                            }

                            // Render multiple vintage options stacked vertically
                            return (
                              <td key={p.partnerId} className="px-1 py-1">
                                <div className={`flex flex-col gap-1 ${validQuotes.length > 1 ? 'max-h-24 overflow-y-auto' : ''}`}>
                                  {validQuotes.map((quoteItem) => {
                                    const quote = quoteItem.quote;
                                    const isSelected = quote.isSelected;
                                    const isAltVintage = quote.quoteType === 'alt_vintage';
                                    const isAltProduct = quote.quoteType === 'alternative';
                                    const price = quote.costPricePerCaseUsd!;
                                    const isBestPrice = minPrice !== null && price === minPrice;
                                    const isHighestPrice =
                                      maxPrice !== null && price === maxPrice && maxPrice !== minPrice;

                                    // Build tooltip with all quote details
                                    const tooltipParts = [];
                                    if (quote.caseConfig) tooltipParts.push(`Config: ${quote.caseConfig}`);
                                    if (quote.availableQuantity) tooltipParts.push(`Avail: ${quote.availableQuantity} cs`);
                                    if (quote.stockLocation) tooltipParts.push(`Location: ${quote.stockLocation}`);
                                    if (quote.stockCondition) tooltipParts.push(`Condition: ${quote.stockCondition}`);
                                    if (quote.leadTimeDays) tooltipParts.push(`Lead: ${quote.leadTimeDays}d`);
                                    if (quote.moq) tooltipParts.push(`MOQ: ${quote.moq} cs`);
                                    if (isAltVintage) {
                                      tooltipParts.unshift(`Alt Vintage: ${quote.alternativeVintage || 'Not specified'}`);
                                      if (quote.alternativeReason) tooltipParts.push(`Reason: ${quote.alternativeReason}`);
                                    }
                                    if (isAltProduct) {
                                      const altDetails = [quote.alternativeProductName, quote.alternativeVintage].filter(Boolean).join(' ');
                                      tooltipParts.unshift(`Alternative: ${altDetails}`);
                                      if (quote.alternativeReason) tooltipParts.push(`Reason: ${quote.alternativeReason}`);
                                    }
                                    const tooltip = tooltipParts.join('\n');

                                    // Get display vintage
                                    const displayVintage = isAltVintage || isAltProduct
                                      ? quote.alternativeVintage
                                      : quote.quotedVintage || item.vintage;

                                    return (
                                      <button
                                        key={quote.id}
                                        onClick={() => handleSelectQuote(item.id, quote.id)}
                                        disabled={!canSelectQuotes || isSelectingQuote}
                                        className={`w-full px-1.5 py-1 rounded text-center transition-all ${
                                          isSelected
                                            ? 'bg-fill-brand text-text-on-brand ring-2 ring-border-brand'
                                            : isBestPrice
                                              ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                              : isHighestPrice
                                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                                : 'bg-fill-muted/50 hover:bg-fill-muted'
                                        } ${!canSelectQuotes ? 'cursor-default' : 'cursor-pointer'}`}
                                        title={tooltip || undefined}
                                        aria-label={`Select quote: $${price.toFixed(0)} ${displayVintage ? `(${displayVintage})` : ''} from ${p.partner.businessName}`}
                                      >
                                        <div className="flex items-center justify-center gap-1">
                                          {/* Vintage badge for multi-vintage visibility */}
                                          {displayVintage && validQuotes.length > 1 && (
                                            <span className={`text-[9px] font-bold px-1 rounded ${
                                              isSelected
                                                ? 'bg-white/20'
                                                : isAltVintage
                                                  ? 'bg-blue-100 text-blue-700'
                                                  : isAltProduct
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}>
                                              {displayVintage}
                                            </span>
                                          )}
                                          {/* Price */}
                                          <span className="text-xs font-semibold">
                                            ${price.toFixed(0)}
                                            {isSelected && (
                                              <IconCheck className="inline-block h-3 w-3 ml-0.5" />
                                            )}
                                          </span>
                                        </div>
                                        {/* Show vintage on separate line if single quote */}
                                        {validQuotes.length === 1 && displayVintage && (
                                          <span className={`text-[10px] block ${
                                            isSelected
                                              ? 'text-text-on-brand/70'
                                              : isAltVintage
                                                ? 'text-blue-600'
                                                : isAltProduct
                                                  ? 'text-amber-600'
                                                  : 'text-text-muted'
                                          }`}>
                                            {displayVintage}
                                          </span>
                                        )}
                                        {/* Case config */}
                                        {quote.caseConfig && (
                                          <span className={`text-[9px] block ${isSelected ? 'text-text-on-brand/60' : 'text-text-muted'}`}>
                                            {quote.caseConfig}pk
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                            );
                          })}

                          {/* Final Price Cell - Compact */}
                          <td className="px-2 py-1.5">
                            {selectedQuote ? (
                              <div className="text-center">
                                {editingItemId === item.id ? (
                                  <div className="flex items-center justify-center gap-0.5">
                                    <input
                                      ref={priceInputRef}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={editingPrice}
                                      onChange={(e) => setEditingPrice(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSavePrice(item.id);
                                        if (e.key === 'Escape') handleCancelEdit();
                                      }}
                                      className="w-16 px-1 py-0.5 text-xs border border-border-brand rounded bg-surface-primary focus:outline-none"
                                    />
                                    <button
                                      onClick={() => handleSavePrice(item.id)}
                                      disabled={isUpdatingItem}
                                      className="p-0.5 text-text-success hover:bg-fill-success/10 rounded"
                                    >
                                      <IconCheck className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() =>
                                      canSelectQuotes &&
                                      handleStartEditPrice(
                                        item.id,
                                        item.finalPriceUsd ||
                                          selectedQuote.quote.costPricePerCaseUsd ||
                                          0,
                                      )
                                    }
                                    className={`text-xs font-semibold ${
                                      item.priceAdjustedBy
                                        ? 'text-fill-brand'
                                        : 'text-text-success'
                                    } ${canSelectQuotes ? 'hover:underline cursor-pointer' : ''}`}
                                    title={canSelectQuotes ? 'Click to edit' : undefined}
                                  >
                                    $
                                    {(
                                      item.finalPriceUsd ||
                                      selectedQuote.quote.costPricePerCaseUsd ||
                                      0
                                    ).toFixed(0)}
                                    {item.priceAdjustedBy && (
                                      <IconEdit className="inline-block h-2.5 w-2.5 ml-0.5 opacity-50" />
                                    )}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-text-muted block text-center">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer Summary */}
            {rfq.items.length > 0 && (
              <div className="p-3 border-t border-border-muted bg-fill-muted/30 flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {filteredItems.length === rfq.items.length
                    ? `${rfq.items.length} items`
                    : `Showing ${filteredItems.length} of ${rfq.items.length} items`}
                </span>
                {selectedCount > 0 && (
                  <span className="text-xs font-medium">
                    Total:{' '}
                    <span className="text-text-success">
                      $
                      {rfq.items
                        .reduce((sum, item) => {
                          const selected = item.quotes.find((q) => q.quote.isSelected);
                          if (!selected || selected.quote.costPricePerCaseUsd === null) return sum;
                          const price =
                            item.finalPriceUsd || selected.quote.costPricePerCaseUsd;
                          return sum + price * (item.quantity || 1);
                        }, 0)
                        .toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                    </span>
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Log */}
        {rfq.activityLogs && rfq.activityLogs.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b border-border-muted">
                <Typography variant="headingSm">Activity Log</Typography>
              </div>
              <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                {rfq.activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 text-sm"
                  >
                    <div className="w-2 h-2 rounded-full bg-fill-muted mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        {log.user && (
                          <span className="text-text-muted">
                            by {log.user.name || log.user.email}
                          </span>
                        )}
                        {log.partner && (
                          <span className="text-text-muted">
                            by {log.partner.businessName}
                          </span>
                        )}
                      </div>
                      {log.previousStatus && log.newStatus && (
                        <div className="text-xs text-text-muted mt-0.5">
                          Status: {log.previousStatus} → {log.newStatus}
                        </div>
                      )}
                      {log.notes && (
                        <div className="text-xs text-text-muted mt-0.5">
                          {log.notes}
                        </div>
                      )}
                      <div className="text-xs text-text-muted mt-1">
                        {new Date(log.createdAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Select Partners Dialog */}
        <SendToPartnersDialog
          rfqId={rfqId}
          open={isSelectPartnersOpen}
          onOpenChange={setIsSelectPartnersOpen}
          onSuccess={() => void refetch()}
        />

        {/* Add Item Modal */}
        <AddItemModal
          open={isAddItemOpen}
          onOpenChange={setIsAddItemOpen}
          rfqId={rfqId}
          onSuccess={() => void refetch()}
        />

        {/* Item Editor Modal */}
        <ItemEditorModal
          open={isItemEditorOpen}
          onOpenChange={setIsItemEditorOpen}
          item={editingItem}
          rfqId={rfqId}
          canEdit={canSendToPartners}
          canDelete={canSendToPartners}
          onSuccess={() => void refetch()}
        />

        {/* Upload Partner Response Dialog */}
        <Dialog open={isUploadPartnerResponseOpen} onOpenChange={handleCloseUploadDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload Partner Response</DialogTitle>
              <DialogDescription>
                Upload an Excel file with a partner&apos;s quote response that was received via email.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Partner Selection */}
              {!parsedPartnerQuotes && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Select Partner
                  </label>
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    className="w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm"
                  >
                    <option value="">Choose a partner...</option>
                    {rfq.partners.map((rp) => (
                      <option key={rp.partnerId} value={rp.partnerId}>
                        {rp.partner.businessName}
                        {rp.status === 'submitted' ? ' (Already submitted)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Show selected partner info when quotes are parsed */}
              {parsedPartnerQuotes && selectedPartnerId && (
                <div className="p-3 bg-fill-brand/5 border border-border-brand rounded-lg">
                  <Typography variant="bodyMd" className="font-medium">
                    Submitting for: {rfq.partners.find((p) => p.partnerId === selectedPartnerId)?.partner.businessName}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    {parsedPartnerQuotes.length} quotes ready to submit
                  </Typography>
                </div>
              )}

              {/* Excel Upload Component */}
              {selectedPartnerId && !parsedPartnerQuotes && (
                <QuoteExcelUpload
                  rfqId={rfqId}
                  partnerId={selectedPartnerId}
                  items={rfq.items.map((item, idx) => ({
                    id: item.id,
                    productName: item.productName,
                    producer: item.producer,
                    vintage: item.vintage,
                    quantity: item.quantity,
                    sortOrder: idx,
                  }))}
                  onQuotesParsed={handlePartnerQuotesParsed}
                  onCancel={handleCloseUploadDialog}
                  showDownloadTemplate={false}
                />
              )}

              {/* Parsed Quotes Summary & Submit Button */}
              {parsedPartnerQuotes && (
                <div className="space-y-4">
                  <div className="border border-border-muted rounded-lg divide-y divide-border-muted max-h-[300px] overflow-y-auto">
                    {parsedPartnerQuotes.map((quote) => {
                      const item = rfq.items.find((i) => i.id === quote.itemId);
                      return (
                        <div key={quote.itemId} className="p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{item?.productName || quote.productName}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              quote.quoteType === 'exact'
                                ? 'bg-green-100 text-green-800'
                                : quote.quoteType === 'alt_vintage'
                                  ? 'bg-blue-100 text-blue-800'
                                  : quote.quoteType === 'alternative'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-red-100 text-red-800'
                            }`}>
                              {quote.quoteType === 'exact' ? 'Exact' : quote.quoteType === 'alt_vintage' ? 'Alt Vintage' : quote.quoteType === 'alternative' ? 'Alt Product' : 'N/A'}
                            </span>
                          </div>
                          {quote.costPricePerCaseUsd && (
                            <span className="text-text-muted">
                              ${quote.costPricePerCaseUsd.toFixed(2)}/case
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setParsedPartnerQuotes(null)}
                    >
                      <ButtonContent iconLeft={IconX}>Back</ButtonContent>
                    </Button>
                    <Button
                      variant="default"
                      colorRole="brand"
                      onClick={handleSubmitOnBehalf}
                      isDisabled={isSubmittingOnBehalf}
                    >
                      <ButtonContent iconLeft={IconCheck}>
                        {isSubmittingOnBehalf ? 'Submitting...' : `Submit ${parsedPartnerQuotes.length} Quotes`}
                      </ButtonContent>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Generate Purchase Orders Dialog */}
        <Dialog open={isGeneratePOsOpen} onOpenChange={(open) => {
          setIsGeneratePOsOpen(open);
          if (!open) {
            setGeneratedPOs(null);
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {generatedPOs ? 'Purchase Orders Generated' : 'Generate Purchase Orders'}
              </DialogTitle>
              <DialogDescription>
                {generatedPOs
                  ? `Successfully created ${generatedPOs.length} purchase order(s)`
                  : 'Create purchase orders for each partner with selected quotes'}
              </DialogDescription>
            </DialogHeader>

            {generatedPOs ? (
              // Success state - show generated POs
              <div className="space-y-4">
                <div className="space-y-2">
                  {generatedPOs.map((po) => (
                    <div
                      key={po.id}
                      className="flex items-center justify-between p-3 bg-fill-success/10 border border-border-success rounded-lg"
                    >
                      <div>
                        <Typography variant="bodyMd" className="font-medium">
                          {po.poNumber}
                        </Typography>
                        <Typography variant="bodySm" colorRole="muted">
                          {po.partnerName} · {po.itemCount} items
                        </Typography>
                      </div>
                      <Typography variant="bodyMd" className="font-medium">
                        ${po.totalAmountUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </Typography>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsGeneratePOsOpen(false);
                      setGeneratedPOs(null);
                    }}
                  >
                    Close
                  </Button>
                  <Link href={`/platform/admin/source/${rfqId}/purchase-orders`}>
                    <Button variant="default" colorRole="brand">
                      <ButtonContent iconLeft={IconPackageExport}>View All POs</ButtonContent>
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              // Form state - enter delivery details
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Delivery Address (optional)</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand"
                    rows={2}
                    placeholder="Enter delivery address..."
                    value={poDeliveryAddress}
                    onChange={(e) => setPoDeliveryAddress(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Terms (optional)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                    placeholder="e.g., Net 30, COD"
                    value={poPaymentTerms}
                    onChange={(e) => setPoPaymentTerms(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes (optional)</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand"
                    rows={2}
                    placeholder="Additional notes for all POs..."
                    value={poNotes}
                    onChange={(e) => setPoNotes(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setIsGeneratePOsOpen(false)}
                    isDisabled={isGeneratingPOs}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    colorRole="brand"
                    onClick={() => {
                      generatePurchaseOrders({
                        rfqId,
                        deliveryAddress: poDeliveryAddress || undefined,
                        paymentTerms: poPaymentTerms || undefined,
                        notes: poNotes || undefined,
                      });
                    }}
                    isDisabled={isGeneratingPOs}
                  >
                    <ButtonContent iconLeft={IconPackageExport}>
                      {isGeneratingPOs ? 'Generating...' : 'Generate POs'}
                    </ButtonContent>
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Cancel RFQ Dialog */}
        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cancel RFQ</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this RFQ? This will stop the sourcing process
                and partners will no longer be able to submit quotes.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setIsCancelDialogOpen(false)}
                className="flex-1"
              >
                Keep Open
              </Button>
              <Button
                variant="default"
                colorRole="danger"
                onClick={() => cancelRfq({ rfqId })}
                isDisabled={isCancelling}
                className="flex-1"
              >
                <ButtonContent iconLeft={IconBan}>
                  {isCancelling ? 'Cancelling...' : 'Cancel RFQ'}
                </ButtonContent>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete RFQ Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete RFQ</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this RFQ? This action cannot be undone and will
                permanently remove the RFQ and all associated items.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                className="flex-1"
              >
                Keep RFQ
              </Button>
              <Button
                variant="default"
                colorRole="danger"
                onClick={() => deleteRfq({ rfqId })}
                isDisabled={isDeleting}
                className="flex-1"
              >
                <ButtonContent iconLeft={IconTrash}>
                  {isDeleting ? 'Deleting...' : 'Delete RFQ'}
                </ButtonContent>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default RfqDetailPage;
