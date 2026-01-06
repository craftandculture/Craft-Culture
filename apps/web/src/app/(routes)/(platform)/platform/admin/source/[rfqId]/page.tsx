'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconSend,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import RfqStatusBadge from '@/app/_source/components/RfqStatusBadge';
import exportRfqToExcel from '@/app/_source/utils/exportRfqToExcel';
import exportRfqToPDF from '@/app/_source/utils/exportRfqToPDF';
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
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);

  // Fetch RFQ data
  const { data: rfq, isLoading, refetch } = useQuery({
    ...api.source.admin.getOne.queryOptions({ rfqId }),
  });

  // Fetch available wine partners
  const { data: availablePartners } = useQuery({
    ...api.partners.getMany.queryOptions({
      type: 'wine_partner',
      status: 'active',
    }),
  });

  // Send to partners mutation
  const { mutate: sendToPartners, isPending: isSending } = useMutation(
    api.source.admin.sendToPartners.mutationOptions({
      onSuccess: () => {
        void refetch();
        setIsSelectPartnersOpen(false);
        setSelectedPartnerIds([]);
      },
    }),
  );

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

  const handleTogglePartner = (partnerId: string) => {
    setSelectedPartnerIds((prev) =>
      prev.includes(partnerId)
        ? prev.filter((id) => id !== partnerId)
        : [...prev, partnerId],
    );
  };

  const handleSendToPartners = () => {
    if (selectedPartnerIds.length === 0) {
      alert('Please select at least one partner');
      return;
    }
    sendToPartners({
      rfqId,
      partnerIds: selectedPartnerIds,
    });
  };

  const handleSelectQuote = (itemId: string, quoteId: string) => {
    selectQuote({ itemId, quoteId });
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

                            return (
                              <td key={p.partnerId} className="px-4 py-3">
                                <button
                                  onClick={() => handleSelectQuote(item.id, quote.quote.id)}
                                  disabled={!canSelectQuotes || isSelectingQuote}
                                  className={`p-2 rounded-lg text-left w-full transition-colors ${
                                    isSelected
                                      ? 'bg-fill-brand/10 border-2 border-border-brand'
                                      : 'bg-fill-muted hover:bg-fill-muted/80 border-2 border-transparent'
                                  } ${!canSelectQuotes ? 'cursor-default' : 'cursor-pointer'}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">
                                      ${quote.quote.costPricePerCaseUsd.toFixed(2)}
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
                                <div className="font-medium text-text-success">
                                  ${item.finalPriceUsd?.toFixed(2) || selectedQuote.quote.costPricePerCaseUsd.toFixed(2)}
                                </div>
                                <div className="text-xs text-text-muted">
                                  {selectedQuote.partner.businessName}
                                </div>
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

        {/* Select Partners Dialog */}
        <Dialog open={isSelectPartnersOpen} onOpenChange={setIsSelectPartnersOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Send RFQ to Partners</DialogTitle>
              <DialogDescription>
                Select wine partners to send this RFQ to for quoting
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 my-4 max-h-96 overflow-y-auto">
              {availablePartners?.map((partner) => (
                <label
                  key={partner.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPartnerIds.includes(partner.id)
                      ? 'border-border-brand bg-fill-brand/5'
                      : 'border-border-muted hover:border-border-primary'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPartnerIds.includes(partner.id)}
                    onChange={() => handleTogglePartner(partner.id)}
                    className="w-4 h-4 rounded border-border-primary"
                  />
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      {partner.businessName}
                    </Typography>
                    {partner.businessEmail && (
                      <Typography variant="bodyXs" colorRole="muted">
                        {partner.businessEmail}
                      </Typography>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <Typography variant="bodySm" colorRole="muted">
                {selectedPartnerIds.length} selected
              </Typography>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsSelectPartnersOpen(false)}>
                  <ButtonContent>Cancel</ButtonContent>
                </Button>
                <Button
                  variant="default"
                  colorRole="brand"
                  onClick={handleSendToPartners}
                  isDisabled={selectedPartnerIds.length === 0 || isSending}
                >
                  <ButtonContent iconLeft={IconSend}>
                    {isSending ? 'Sending...' : 'Send RFQ'}
                  </ButtonContent>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default RfqDetailPage;
