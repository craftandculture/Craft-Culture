'use client';

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconEdit,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconFilter,
  IconFilterOff,
  IconPlus,
  IconSelectAll,
  IconSend,
  IconSparkles,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import AddItemModal from '@/app/_source/components/AddItemModal';
import ItemEditorModal from '@/app/_source/components/ItemEditorModal';
import type { ItemData } from '@/app/_source/components/ItemEditorModal';
import QuoteExcelUpload from '@/app/_source/components/QuoteExcelUpload';
import RfqStatusBadge from '@/app/_source/components/RfqStatusBadge';
import SendToPartnersDialog from '@/app/_source/components/SendToPartnersDialog';
import exportRfqToExcel from '@/app/_source/utils/exportRfqToExcel';
import exportRfqToPDF from '@/app/_source/utils/exportRfqToPDF';
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
        costPricePerCaseUsd: q.costPricePerCaseUsd,
        currency: 'USD',
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
                                {item.lwin && (
                                  <span className="font-mono bg-fill-muted px-1 rounded">
                                    {item.lwin}
                                  </span>
                                )}
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

                          {/* Partner Quote Cells - With Details */}
                          {uniquePartners.map((p) => {
                            const quote = item.quotes.find(
                              (q) => q.quote.partnerId === p.partnerId,
                            );

                            if (!quote) {
                              return (
                                <td
                                  key={p.partnerId}
                                  className="px-1 py-2 text-center text-[10px] text-text-muted"
                                >
                                  —
                                </td>
                              );
                            }

                            const isSelected = quote.quote.isSelected;
                            const isAlternative = quote.quote.quoteType === 'alternative';
                            const isNotAvailable = quote.quote.quoteType === 'not_available';
                            const price = quote.quote.costPricePerCaseUsd;
                            const isBestPrice = minPrice !== null && price === minPrice;
                            const isHighestPrice =
                              maxPrice !== null && price === maxPrice && maxPrice !== minPrice;

                            // N/A quotes - compact display
                            if (isNotAvailable || price === null) {
                              return (
                                <td key={p.partnerId} className="px-1 py-2 text-center">
                                  <span
                                    className="text-[10px] text-text-danger bg-fill-danger/10 px-1.5 py-0.5 rounded"
                                    title={quote.quote.notAvailableReason || 'Not available'}
                                  >
                                    N/A
                                  </span>
                                </td>
                              );
                            }

                            // Build tooltip with all quote details
                            const tooltipParts = [];
                            if (quote.quote.caseConfig) tooltipParts.push(`Config: ${quote.quote.caseConfig}`);
                            if (quote.quote.availableQuantity) tooltipParts.push(`Avail: ${quote.quote.availableQuantity} cs`);
                            if (quote.quote.stockLocation) tooltipParts.push(`Location: ${quote.quote.stockLocation}`);
                            if (quote.quote.stockCondition) tooltipParts.push(`Condition: ${quote.quote.stockCondition}`);
                            if (quote.quote.leadTimeDays) tooltipParts.push(`Lead: ${quote.quote.leadTimeDays}d`);
                            if (quote.quote.moq) tooltipParts.push(`MOQ: ${quote.quote.moq} cs`);
                            if (isAlternative) {
                              const altDetails = [quote.quote.alternativeProductName, quote.quote.alternativeVintage].filter(Boolean).join(' ');
                              tooltipParts.unshift(`Alternative: ${altDetails}`);
                              if (quote.quote.alternativeReason) tooltipParts.push(`Reason: ${quote.quote.alternativeReason}`);
                            }
                            const tooltip = tooltipParts.join('\n');

                            return (
                              <td key={p.partnerId} className="px-1 py-2">
                                <button
                                  onClick={() => handleSelectQuote(item.id, quote.quote.id)}
                                  disabled={!canSelectQuotes || isSelectingQuote}
                                  className={`w-full px-2 py-2.5 sm:px-1.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded text-center transition-all ${
                                    isSelected
                                      ? 'bg-fill-brand text-text-on-brand ring-2 ring-border-brand'
                                      : isBestPrice
                                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                        : isHighestPrice
                                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                          : 'bg-fill-muted/50 hover:bg-fill-muted'
                                  } ${!canSelectQuotes ? 'cursor-default' : 'cursor-pointer'}`}
                                  title={tooltip || undefined}
                                  aria-label={`Select quote: $${price.toFixed(0)} from ${p.partner.businessName}${isAlternative ? ' (alternative)' : ''}`}
                                >
                                  {/* Price */}
                                  <div className="text-xs font-semibold">
                                    ${price.toFixed(0)}
                                    {isSelected && (
                                      <IconCheck className="inline-block h-3 w-3 ml-0.5" />
                                    )}
                                  </div>
                                  {/* Quick Details */}
                                  <div className={`text-[9px] mt-0.5 ${isSelected ? 'text-text-on-brand/80' : 'text-text-muted'}`}>
                                    {quote.quote.caseConfig && (
                                      <span>{quote.quote.caseConfig}</span>
                                    )}
                                    {quote.quote.stockLocation && (
                                      <span className="ml-1">{quote.quote.stockLocation.replace('_bonded', '').replace('_', ' ').toUpperCase()}</span>
                                    )}
                                  </div>
                                  {/* Vintage indicator - show what vintage was quoted */}
                                  {isAlternative ? (
                                    <span className={`text-[9px] block font-medium ${isSelected ? 'text-amber-200' : 'text-text-warning'}`}>
                                      {quote.quote.alternativeVintage || 'ALT'}
                                    </span>
                                  ) : (
                                    item.vintage && (
                                      <span className={`text-[9px] block ${isSelected ? 'text-text-on-brand/70' : 'text-text-muted'}`}>
                                        {item.vintage}
                                      </span>
                                    )
                                  )}
                                </button>
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
                                : quote.quoteType === 'alternative'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                            }`}>
                              {quote.quoteType === 'exact' ? 'Exact' : quote.quoteType === 'alternative' ? 'Alt' : 'N/A'}
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
      </div>
    </div>
  );
};

export default RfqDetailPage;
