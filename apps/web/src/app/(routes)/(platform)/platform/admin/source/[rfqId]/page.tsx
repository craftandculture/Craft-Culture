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
import formatLwin18 from '@/app/_source/utils/formatLwin18';
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
  const canAddItems = ['draft', 'parsing', 'ready_to_send', 'sent', 'collecting', 'comparing', 'selecting'].includes(rfq.status);
  const canGenerateQuote = rfq.status === 'selecting' || rfq.items.some((i) => i.selectedQuoteId);
  const canDelete = ['draft', 'parsing', 'ready_to_send'].includes(rfq.status);
  const canCancel = ['sent', 'collecting', 'comparing', 'selecting', 'quote_generated', 'client_review', 'awaiting_confirmation', 'confirmed'].includes(rfq.status);
  const isCancelled = rfq.status === 'cancelled';
  const isFinalized = ['quote_generated', 'confirmed', 'closed'].includes(rfq.status);

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
            {canAddItems && (
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

                  {/* Step 2: Export Quote */}
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isFinalized
                        ? 'bg-fill-success text-white'
                        : selectedCount > 0
                          ? 'bg-fill-brand/20 text-fill-brand border-2 border-fill-brand'
                          : 'bg-fill-muted text-text-muted'
                    }`}>
                      {isFinalized ? (
                        <IconCircleCheck className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-bold">2</span>
                      )}
                    </div>
                    <div className="hidden sm:block">
                      <Typography variant="bodySm" className="font-semibold">Export Quote</Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        Generate client quote
                      </Typography>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex items-center gap-3">
                  {!isFinalized && (
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
                  {isFinalized && (
                    <div className="text-right hidden sm:block">
                      <Typography variant="bodySm" className="font-medium text-text-success">
                        Quote exported!
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        RFQ complete
                      </Typography>
                    </div>
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
                      <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide w-[280px] min-w-[200px]">
                        Product
                      </th>
                      <th className="px-1 py-1.5 text-center text-[10px] font-semibold text-text-muted uppercase tracking-wide w-16">
                        Format
                      </th>
                      <th className="px-1 py-1.5 text-center text-[10px] font-semibold text-text-muted uppercase tracking-wide w-10">
                        Qty
                      </th>
                      {uniquePartners.map((p) => (
                        <th
                          key={p.partnerId}
                          className="px-1 py-1.5 text-center text-[10px] font-semibold text-text-muted uppercase tracking-wide min-w-[120px]"
                        >
                          <span className="truncate block" title={p.partner.businessName}>
                            {p.partner.businessName.length > 12
                              ? `${p.partner.businessName.slice(0, 10)}...`
                              : p.partner.businessName}
                          </span>
                        </th>
                      ))}
                      <th className="px-1 py-1.5 text-center text-[10px] font-semibold text-text-muted uppercase tracking-wide w-14">
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
                          {/* Product Cell - Name, Vintage, LWIN, Region - Clickable to Edit */}
                          <td className="px-2 py-1 w-[280px] min-w-[200px]">
                            <button
                              type="button"
                              onClick={() => handleOpenItemEditor(item)}
                              className={`w-full text-left min-w-0 group overflow-hidden ${
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
                              <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-text-muted truncate">
                                {item.lwin && (() => {
                                  const lwin18 = formatLwin18({
                                    lwin: item.lwin,
                                    vintage: item.vintage,
                                    bottleSize: item.bottleSize,
                                    caseConfig: item.caseConfig,
                                  });
                                  return (
                                    <span className="font-mono opacity-60" title={`LWIN-18: ${lwin18 || item.lwin}`}>
                                      {lwin18 || item.lwin}
                                    </span>
                                  );
                                })()}
                                {!item.lwin && item.parseConfidence !== null && item.parseConfidence >= 0.7 && (
                                  <span className="text-text-warning">No LWIN</span>
                                )}
                                {item.region && (
                                  <>
                                    {item.lwin && <span className="opacity-40">·</span>}
                                    <span>{item.region}</span>
                                  </>
                                )}
                                {item.country && !item.region && (
                                  <>
                                    {item.lwin && <span className="opacity-40">·</span>}
                                    <span>{item.country}</span>
                                  </>
                                )}
                              </div>
                            </button>
                          </td>

                          {/* Format Cell - Bottle Size & Case Config - Clickable to Edit */}
                          {(() => {
                            // Get format from item, or fall back to first available quote
                            const hasItemFormat = item.bottleSize || item.caseConfig;
                            const availableQuotes = item.quotes.filter(
                              (q) => q.quote.quoteType !== 'not_available' && q.quote.caseConfig
                            );
                            const quoteFormat = availableQuotes[0]?.quote;
                            const displayBottleSize = item.bottleSize || quoteFormat?.bottleSize;
                            const displayCaseConfig = item.caseConfig || quoteFormat?.caseConfig;
                            const isFromQuote = !hasItemFormat && (displayBottleSize || displayCaseConfig);

                            return (
                              <td className="px-1 py-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenItemEditor(item)}
                                  className={`text-[10px] rounded px-1.5 py-0.5 transition-colors whitespace-nowrap ${
                                    !displayBottleSize && !displayCaseConfig
                                      ? 'bg-fill-warning/10 border border-border-warning hover:bg-fill-warning/20 text-text-warning'
                                      : isFromQuote
                                        ? 'bg-fill-brand/10 border border-border-brand hover:bg-fill-brand/20 text-text-brand'
                                        : 'hover:bg-fill-muted'
                                  }`}
                                  title={isFromQuote ? 'Format from partner quote (click to set)' : 'Click to edit format'}
                                >
                                  {(displayBottleSize || displayCaseConfig) ? (
                                    <span>
                                      {displayBottleSize}{displayBottleSize && displayCaseConfig && '·'}{displayCaseConfig && `${displayCaseConfig}pk`}
                                    </span>
                                  ) : (
                                    <span>+ Add</span>
                                  )}
                                </button>
                              </td>
                            );
                          })()}

                          {/* Quantity - compact */}
                          <td className="px-1 py-1 text-center">
                            <span className="text-xs font-semibold">{item.quantity}</span>
                            <span className="text-[10px] text-text-muted ml-0.5">{item.quantityUnit === 'bottles' ? 'btl' : 'cs'}</span>
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

                            // Render quotes horizontally for quick comparison
                            return (
                              <td key={p.partnerId} className="px-1 py-1">
                                <div className="flex flex-row flex-wrap gap-1 justify-center">
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
                                    // For exact/alt_vintage: use quotedVintage (what partner is actually quoting)
                                    // For alternative product: use alternativeVintage
                                    const displayVintage = isAltProduct
                                      ? quote.alternativeVintage
                                      : quote.quotedVintage || item.vintage;

                                    // Only show vintage if different from item's vintage
                                    const showVintage = displayVintage && displayVintage !== item.vintage;

                                    // Calculate pricing based on what customer requested
                                    const caseConfig = quote.caseConfig ? Number(quote.caseConfig) : 0;
                                    const pricePerBottle = caseConfig > 0 ? price / caseConfig : null;
                                    const requestedInBottles = item.quantityUnit === 'bottles';

                                    // Calculate total to fulfill request
                                    let totalCost: number | null = null;
                                    if (requestedInBottles && pricePerBottle !== null) {
                                      // Customer wants X bottles, calculate cost
                                      totalCost = pricePerBottle * item.quantity;
                                    } else if (!requestedInBottles) {
                                      // Customer wants X cases
                                      totalCost = price * item.quantity;
                                    }

                                    return (
                                      <button
                                        key={quote.id}
                                        onClick={() => handleSelectQuote(item.id, quote.id)}
                                        disabled={!canSelectQuotes || isSelectingQuote}
                                        className={`px-3 py-1 rounded text-center transition-all min-w-[90px] ${
                                          isSelected
                                            ? 'bg-fill-brand text-text-on-brand ring-2 ring-border-brand'
                                            : isBestPrice
                                              ? 'bg-fill-success/10 text-text-success hover:bg-fill-success/20 dark:bg-fill-success/20 dark:hover:bg-fill-success/30'
                                              : isHighestPrice
                                                ? 'bg-fill-danger/10 text-text-danger hover:bg-fill-danger/20 dark:bg-fill-danger/20 dark:hover:bg-fill-danger/30'
                                                : 'bg-fill-muted/50 hover:bg-fill-muted'
                                        } ${!canSelectQuotes ? 'cursor-default' : 'cursor-pointer'}`}
                                        title={tooltip || undefined}
                                        aria-label={`Select quote: $${price.toFixed(0)} ${displayVintage ? `(${displayVintage})` : ''} from ${p.partner.businessName}`}
                                      >
                                        {requestedInBottles && pricePerBottle !== null ? (
                                          <>
                                            {/* When customer requested bottles: show per-bottle prominently */}
                                            <div className="flex items-center justify-center gap-0.5">
                                              <span className="text-sm font-bold">
                                                ${pricePerBottle.toFixed(2)}
                                              </span>
                                              <span className={`text-[9px] ${isSelected ? 'text-text-on-brand/70' : 'text-text-muted'}`}>/btl</span>
                                              {isSelected && (
                                                <IconCheck className="h-3.5 w-3.5" />
                                              )}
                                            </div>
                                            {/* Show case price as secondary */}
                                            <span className={`text-[10px] block ${isSelected ? 'text-text-on-brand/70' : 'text-text-muted'}`}>
                                              ${price.toFixed(0)}/cs
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            {/* When customer requested cases: show per-case prominently */}
                                            <div className="flex items-center justify-center gap-0.5">
                                              <span className="text-sm font-bold">
                                                ${price.toFixed(0)}
                                              </span>
                                              <span className={`text-[9px] ${isSelected ? 'text-text-on-brand/70' : 'text-text-muted'}`}>/cs</span>
                                              {isSelected && (
                                                <IconCheck className="h-3.5 w-3.5" />
                                              )}
                                            </div>
                                            {/* Show per-bottle as secondary */}
                                            {pricePerBottle !== null && (
                                              <span className={`text-[10px] block ${isSelected ? 'text-text-on-brand/70' : 'text-text-muted'}`}>
                                                ${pricePerBottle.toFixed(2)}/btl
                                              </span>
                                            )}
                                          </>
                                        )}
                                        {/* Show total cost to fulfill request */}
                                        {totalCost !== null && item.quantity > 1 && (
                                          <span className={`text-[9px] block font-medium ${isSelected ? 'text-text-on-brand/80' : 'text-text-primary'}`}>
                                            = ${totalCost.toFixed(0)}
                                          </span>
                                        )}
                                        {/* Vintage only when different from item - highlighted */}
                                        {showVintage && (
                                          <span className={`text-[10px] font-semibold block ${
                                            isSelected
                                              ? 'text-text-on-brand'
                                              : isAltVintage
                                                ? 'text-text-brand'
                                                : isAltProduct
                                                  ? 'text-text-warning'
                                                  : 'text-text-brand'
                                          }`}>
                                            {displayVintage}
                                          </span>
                                        )}
                                        {/* Lead time indicator - compact */}
                                        {quote.leadTimeDays !== null && quote.leadTimeDays > 0 && (
                                          <span className={`text-[9px] block ${isSelected ? 'text-text-on-brand/60' : 'text-text-muted'}`}>
                                            {quote.leadTimeDays}d
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
          canEdit={canAddItems}
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
                                ? 'bg-fill-success/20 text-text-success'
                                : quote.quoteType === 'alt_vintage'
                                  ? 'bg-fill-brand/20 text-text-brand'
                                  : quote.quoteType === 'alternative'
                                    ? 'bg-fill-warning/20 text-text-warning'
                                    : 'bg-fill-danger/20 text-text-danger'
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
