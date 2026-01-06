'use client';

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconSend,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import RfqStatusBadge from '@/app/_source/components/RfqStatusBadge';
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
import type { sourceRfqQuoteType } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type QuoteType = (typeof sourceRfqQuoteType.enumValues)[number];

interface QuoteEntry {
  itemId: string;
  quoteType: QuoteType;
  costPricePerCaseUsd: number;
  currency: string;
  availableQuantity?: number;
  leadTimeDays?: number;
  stockLocation?: string;
  notes?: string;
  alternativeProductName?: string;
  alternativeProducer?: string;
  alternativeVintage?: string;
  alternativeReason?: string;
}

/**
 * Partner RFQ detail page - submit quotes for items
 */
const PartnerRfqDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const rfqId = params.rfqId as string;
  const api = useTRPC();

  const [quotes, setQuotes] = useState<Map<string, QuoteEntry>>(new Map());
  const [partnerNotes, setPartnerNotes] = useState('');
  const [isDeclineDialogOpen, setIsDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Fetch RFQ data
  const { data: rfq, isLoading, refetch } = useQuery({
    ...api.source.partner.getOne.queryOptions({ rfqId }),
  });

  // Submit quotes mutation
  const { mutate: submitQuotes, isPending: isSubmitting } = useMutation(
    api.source.partner.submitQuotes.mutationOptions({
      onSuccess: () => {
        void refetch();
        alert('Quotes submitted successfully!');
      },
    }),
  );

  // Decline mutation
  const { mutate: declineRfq, isPending: isDeclining } = useMutation(
    api.source.partner.decline.mutationOptions({
      onSuccess: () => {
        router.push('/platform/partner/source');
      },
    }),
  );

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
          RFQ not found or not assigned to you
        </Typography>
      </div>
    );
  }

  // Check if deadline has passed
  const isDeadlinePassed =
    rfq.responseDeadline && new Date() > new Date(rfq.responseDeadline);
  const canSubmit =
    rfq.partnerStatus !== 'submitted' &&
    rfq.partnerStatus !== 'declined' &&
    !isDeadlinePassed;

  const handleQuoteChange = (
    itemId: string,
    field: keyof QuoteEntry,
    value: string | number,
  ) => {
    const currentQuote = quotes.get(itemId) || {
      itemId,
      quoteType: 'exact' as QuoteType,
      costPricePerCaseUsd: 0,
      currency: 'USD',
    };

    setQuotes(new Map(quotes.set(itemId, { ...currentQuote, [field]: value })));
  };

  const handleSubmitQuotes = () => {
    const quotesToSubmit = Array.from(quotes.values()).filter(
      (q) => q.costPricePerCaseUsd > 0,
    );

    if (quotesToSubmit.length === 0) {
      alert('Please enter at least one quote');
      return;
    }

    submitQuotes({
      rfqId,
      quotes: quotesToSubmit,
      partnerNotes,
    });
  };

  const handleDecline = () => {
    declineRfq({
      rfqId,
      reason: declineReason,
    });
  };

  const getQuoteForItem = (itemId: string): QuoteEntry | undefined => {
    return quotes.get(itemId);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/platform/partner/source">
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
              {rfq.responseDeadline && (
                <div className="flex items-center gap-2 mt-1 text-text-muted">
                  <IconCalendar className="h-4 w-4" />
                  <Typography variant="bodySm">
                    Due {format(new Date(rfq.responseDeadline), 'PPP')} (
                    {formatDistanceToNow(new Date(rfq.responseDeadline), { addSuffix: true })})
                  </Typography>
                </div>
              )}
            </div>
          </div>

          {canSubmit && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                colorRole="danger"
                onClick={() => setIsDeclineDialogOpen(true)}
              >
                <ButtonContent iconLeft={IconX}>Decline</ButtonContent>
              </Button>
              <Button
                variant="default"
                colorRole="brand"
                onClick={handleSubmitQuotes}
                isDisabled={isSubmitting || quotes.size === 0}
              >
                <ButtonContent iconLeft={IconSend}>
                  {isSubmitting ? 'Submitting...' : 'Submit Quotes'}
                </ButtonContent>
              </Button>
            </div>
          )}
        </div>

        {/* Status banner */}
        {rfq.partnerStatus === 'submitted' && (
          <Card className="border-border-success bg-fill-success/5">
            <CardContent className="p-4 flex items-center gap-3">
              <IconCheck className="h-5 w-5 text-text-success" />
              <Typography variant="bodyMd" className="text-text-success">
                You have submitted {rfq.quoteCount} quotes for this RFQ.
              </Typography>
            </CardContent>
          </Card>
        )}

        {rfq.partnerStatus === 'declined' && (
          <Card className="border-border-danger bg-fill-danger/5">
            <CardContent className="p-4 flex items-center gap-3">
              <IconX className="h-5 w-5 text-text-danger" />
              <Typography variant="bodyMd" className="text-text-danger">
                You have declined this RFQ.
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Deadline passed warning */}
        {isDeadlinePassed && rfq.partnerStatus !== 'submitted' && rfq.partnerStatus !== 'declined' && (
          <Card className="border-border-warning bg-fill-warning/5">
            <CardContent className="p-4 flex items-center gap-3">
              <IconAlertTriangle className="h-5 w-5 text-text-warning" />
              <Typography variant="bodyMd" className="text-text-warning">
                The deadline for this RFQ has passed. Quotes can no longer be submitted.
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Items to quote */}
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b border-border-muted flex items-center justify-between">
              <Typography variant="headingSm">
                Items to Quote ({rfq.items.length})
              </Typography>
              {canSubmit && (
                <Typography variant="bodySm" colorRole="muted">
                  Enter your cost price per case for each item
                </Typography>
              )}
            </div>

            <div className="divide-y divide-border-muted">
              {rfq.items.map((item) => {
                const quote = getQuoteForItem(item.id);
                const existingQuote = item.myQuote;
                const isAlternative = quote?.quoteType === 'alternative';

                return (
                  <div key={item.id} className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      {/* Item info */}
                      <div className="flex-1">
                        <Typography variant="bodySm" className="font-medium">
                          {item.productName}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {[item.producer, item.vintage, item.region]
                            .filter(Boolean)
                            .join(' - ')}
                        </Typography>
                        <Typography variant="bodyXs" className="mt-1">
                          Requested: <strong>{item.quantity} cases</strong>
                          {item.bottleSize && ` (${item.bottleSize})`}
                          {item.caseConfig && ` x${item.caseConfig}`}
                        </Typography>
                      </div>

                      {/* Quote input or existing quote */}
                      {canSubmit ? (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={quote?.quoteType || 'exact'}
                              onChange={(e) =>
                                handleQuoteChange(
                                  item.id,
                                  'quoteType',
                                  e.target.value as QuoteType,
                                )
                              }
                              className="rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                            >
                              <option value="exact">Exact Match</option>
                              <option value="alternative">Alternative</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-sm text-text-muted">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={quote?.costPricePerCaseUsd || ''}
                              onChange={(e) =>
                                handleQuoteChange(
                                  item.id,
                                  'costPricePerCaseUsd',
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-28 rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm text-right"
                            />
                            <span className="text-sm text-text-muted">/case</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              placeholder="Lead"
                              value={quote?.leadTimeDays || ''}
                              onChange={(e) =>
                                handleQuoteChange(
                                  item.id,
                                  'leadTimeDays',
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              className="w-20 rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                            />
                            <span className="text-sm text-text-muted">days</span>
                          </div>
                        </div>
                      ) : existingQuote ? (
                        <div className="text-right">
                          <Typography variant="bodySm" className="font-medium">
                            ${existingQuote.costPricePerCaseUsd.toFixed(2)}/case
                          </Typography>
                          {existingQuote.quoteType === 'alternative' && (
                            <Typography variant="bodyXs" className="text-text-warning">
                              Alternative: {existingQuote.alternativeProductName}
                            </Typography>
                          )}
                          {existingQuote.leadTimeDays && (
                            <Typography variant="bodyXs" colorRole="muted">
                              {existingQuote.leadTimeDays} days lead time
                            </Typography>
                          )}
                        </div>
                      ) : (
                        <Typography variant="bodySm" colorRole="muted">
                          No quote
                        </Typography>
                      )}
                    </div>

                    {/* Alternative details */}
                    {canSubmit && isAlternative && (
                      <div className="mt-4 p-3 bg-fill-warning/5 border border-border-warning rounded-lg space-y-3">
                        <Typography variant="bodySm" className="font-medium text-text-warning">
                          Alternative Product Details
                        </Typography>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <input
                            type="text"
                            placeholder="Alternative product name"
                            value={quote?.alternativeProductName || ''}
                            onChange={(e) =>
                              handleQuoteChange(item.id, 'alternativeProductName', e.target.value)
                            }
                            className="rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Producer"
                            value={quote?.alternativeProducer || ''}
                            onChange={(e) =>
                              handleQuoteChange(item.id, 'alternativeProducer', e.target.value)
                            }
                            className="rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Vintage"
                            value={quote?.alternativeVintage || ''}
                            onChange={(e) =>
                              handleQuoteChange(item.id, 'alternativeVintage', e.target.value)
                            }
                            className="rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                          />
                        </div>
                        <textarea
                          placeholder="Reason for alternative (e.g., vintage not available, similar quality alternative)"
                          value={quote?.alternativeReason || ''}
                          onChange={(e) =>
                            handleQuoteChange(item.id, 'alternativeReason', e.target.value)
                          }
                          rows={2}
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Partner notes */}
        {canSubmit && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <Typography variant="headingSm">Additional Notes</Typography>
              <textarea
                value={partnerNotes}
                onChange={(e) => setPartnerNotes(e.target.value)}
                placeholder="Any notes about pricing, availability, delivery, etc."
                rows={3}
                className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
              />
            </CardContent>
          </Card>
        )}

        {/* Decline dialog */}
        <Dialog open={isDeclineDialogOpen} onOpenChange={setIsDeclineDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Decline RFQ</DialogTitle>
              <DialogDescription>
                Are you sure you want to decline this RFQ? You will not be able to submit
                quotes after declining.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Products not available, pricing not competitive, etc."
                  rows={3}
                  className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeclineDialogOpen(false)}>
                <ButtonContent>Cancel</ButtonContent>
              </Button>
              <Button
                variant="default"
                colorRole="danger"
                onClick={handleDecline}
                isDisabled={isDeclining}
              >
                <ButtonContent>
                  {isDeclining ? 'Declining...' : 'Decline RFQ'}
                </ButtonContent>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PartnerRfqDetailPage;
