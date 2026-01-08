'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconEdit,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconRefresh,
  IconSend,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import RfqStatusBadge from '@/app/_source/components/RfqStatusBadge';
import SendToPartnersDialog from '@/app/_source/components/SendToPartnersDialog';
import exportRfqToExcel from '@/app/_source/utils/exportRfqToExcel';
import exportRfqToPDF from '@/app/_source/utils/exportRfqToPDF';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
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

  // State for editing prices
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const priceInputRef = useRef<HTMLInputElement>(null);

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

  // Reset price to cost price
  const handleResetPrice = (itemId: string) => {
    updateItem({ itemId, finalPriceUsd: null });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingPrice('');
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/platform/admin/source">
              <Button variant="ghost" size="sm">
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

          <div className="flex items-center gap-2">
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
              <Typography variant="headingSm" className="mb-4">
                Partner Responses
              </Typography>
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

        {/* Items & Comparison Table */}
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b border-border-muted">
              <Typography variant="headingSm">Items & Quotes</Typography>
            </div>

            {rfq.items.length === 0 ? (
              <div className="p-6 text-center">
                <Typography variant="bodyMd" colorRole="muted">
                  No items yet. Add items to this RFQ.
                </Typography>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-fill-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">
                        Qty
                      </th>
                      {uniquePartners.map((p) => (
                        <th
                          key={p.partnerId}
                          className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase"
                        >
                          {p.partner.businessName}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">
                        Selected
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-muted">
                    {rfq.items.map((item) => {
                      const selectedQuote = item.quotes.find((q) => q.quote.isSelected);

                      // Calculate min/max prices for color coding
                      const quotePrices = item.quotes
                        .map((q) => q.quote.costPricePerCaseUsd)
                        .filter((p) => p > 0);
                      const minPrice = quotePrices.length > 0 ? Math.min(...quotePrices) : null;
                      const maxPrice =
                        quotePrices.length > 1 ? Math.max(...quotePrices) : null;

                      return (
                        <tr key={item.id} className="hover:bg-fill-muted/50">
                          <td className="px-4 py-3">
                            <div>
                              <Typography variant="bodySm" className="font-medium">
                                {item.productName}
                              </Typography>
                              <Typography variant="bodyXs" colorRole="muted">
                                {[item.producer, item.vintage, item.region]
                                  .filter(Boolean)
                                  .join(' - ')}
                              </Typography>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">{item.quantity}</td>

                          {/* Partner quote cells */}
                          {uniquePartners.map((p) => {
                            const quote = item.quotes.find(
                              (q) => q.quote.partnerId === p.partnerId,
                            );

                            if (!quote) {
                              return (
                                <td key={p.partnerId} className="px-4 py-3 text-sm text-text-muted">
                                  -
                                </td>
                              );
                            }

                            const isSelected = quote.quote.isSelected;
                            const isAlternative = quote.quote.quoteType === 'alternative';
                            const price = quote.quote.costPricePerCaseUsd;
                            const isBestPrice = minPrice !== null && price === minPrice;
                            const isHighestPrice =
                              maxPrice !== null && price === maxPrice && maxPrice !== minPrice;

                            return (
                              <td key={p.partnerId} className="px-4 py-3">
                                <button
                                  onClick={() => handleSelectQuote(item.id, quote.quote.id)}
                                  disabled={!canSelectQuotes || isSelectingQuote}
                                  className={`p-2 rounded-lg text-left w-full transition-colors ${
                                    isSelected
                                      ? 'bg-fill-brand/10 border-2 border-border-brand'
                                      : isBestPrice
                                        ? 'bg-fill-success/10 hover:bg-fill-success/20 border-2 border-transparent'
                                        : isHighestPrice
                                          ? 'bg-fill-danger/10 hover:bg-fill-danger/20 border-2 border-transparent'
                                          : 'bg-fill-muted hover:bg-fill-muted/80 border-2 border-transparent'
                                  } ${!canSelectQuotes ? 'cursor-default' : 'cursor-pointer'}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span
                                      className={`font-medium text-sm ${
                                        isBestPrice
                                          ? 'text-text-success'
                                          : isHighestPrice
                                            ? 'text-text-danger'
                                            : ''
                                      }`}
                                    >
                                      ${price.toFixed(2)}
                                    </span>
                                    {isSelected && (
                                      <IconCheck className="h-4 w-4 text-text-brand" />
                                    )}
                                  </div>
                                  {isAlternative && (
                                    <span className="text-xs text-text-warning">
                                      Alt: {quote.quote.alternativeProductName}
                                    </span>
                                  )}
                                  {quote.quote.leadTimeDays && (
                                    <span className="text-xs text-text-muted block">
                                      {quote.quote.leadTimeDays} days
                                    </span>
                                  )}
                                </button>
                              </td>
                            );
                          })}

                          <td className="px-4 py-3">
                            {selectedQuote ? (
                              <div className="text-sm">
                                {editingItemId === item.id ? (
                                  // Editing mode
                                  <div className="flex items-center gap-1">
                                    <span className="text-text-muted">$</span>
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
                                      className="w-20 px-1 py-0.5 text-sm border border-border-brand rounded bg-surface-primary focus:outline-none focus:ring-1 focus:ring-fill-brand"
                                    />
                                    <button
                                      onClick={() => handleSavePrice(item.id)}
                                      disabled={isUpdatingItem}
                                      className="p-1 text-text-success hover:bg-fill-success/10 rounded"
                                    >
                                      <IconCheck className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  // Display mode
                                  <div className="flex items-center gap-2">
                                    <div>
                                      <div
                                        className={`font-medium ${
                                          item.priceAdjustedBy
                                            ? 'text-fill-brand'
                                            : 'text-text-success'
                                        }`}
                                      >
                                        ${item.finalPriceUsd?.toFixed(2) || selectedQuote.quote.costPricePerCaseUsd.toFixed(2)}
                                        {item.priceAdjustedBy && (
                                          <span className="ml-1 text-xs text-text-muted">(adj)</span>
                                        )}
                                      </div>
                                      <div className="text-xs text-text-muted">
                                        {selectedQuote.partner.businessName}
                                      </div>
                                    </div>
                                    {canSelectQuotes && (
                                      <div className="flex items-center gap-0.5">
                                        <button
                                          onClick={() =>
                                            handleStartEditPrice(
                                              item.id,
                                              item.finalPriceUsd ||
                                                selectedQuote.quote.costPricePerCaseUsd,
                                            )
                                          }
                                          className="p-1 text-text-muted hover:text-text-primary hover:bg-fill-muted rounded"
                                          title="Edit price"
                                        >
                                          <IconEdit className="h-3.5 w-3.5" />
                                        </button>
                                        {item.priceAdjustedBy && (
                                          <button
                                            onClick={() => handleResetPrice(item.id)}
                                            disabled={isUpdatingItem}
                                            className="p-1 text-text-muted hover:text-text-warning hover:bg-fill-warning/10 rounded"
                                            title="Reset to cost price"
                                          >
                                            <IconRefresh className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-text-muted">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
      </div>
    </div>
  );
};

export default RfqDetailPage;
