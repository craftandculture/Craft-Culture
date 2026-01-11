'use client';

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconInbox,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type ConfirmationAction = 'confirm' | 'update' | 'reject';

interface QuoteConfirmation {
  quoteId: string;
  action: ConfirmationAction;
  updatedPriceUsd?: number;
  updatedAvailableQty?: number;
  reason?: string;
  notes?: string;
}

/**
 * Partner Quote Confirmation page
 *
 * Allows partners to confirm, update, or reject their selected quotes
 */
const PartnerConfirmationsPage = () => {
  const api = useTRPC();
  const router = useRouter();
  const [expandedRfqs, setExpandedRfqs] = useState<Set<string>>(new Set());
  const [confirmations, setConfirmations] = useState<Map<string, QuoteConfirmation>>(new Map());
  const [submittingRfqId, setSubmittingRfqId] = useState<string | null>(null);

  // Fetch pending confirmation requests
  const { data, isLoading, refetch } = useQuery({
    ...api.source.partner.getConfirmationRequests.queryOptions(),
  });

  // Submit confirmations mutation
  const { mutate: submitConfirmations, isPending: isSubmitting } = useMutation(
    api.source.partner.confirmQuotes.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        // Clear confirmations for this RFQ
        const newConfirmations = new Map(confirmations);
        for (const r of result.results) {
          newConfirmations.delete(r.quoteId);
        }
        setConfirmations(newConfirmations);
        setSubmittingRfqId(null);
        void refetch();
        if (result.allConfirmed) {
          router.push('/platform/partner/source');
        }
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to submit confirmations');
        setSubmittingRfqId(null);
      },
    }),
  );

  const toggleRfqExpanded = (rfqId: string) => {
    const newExpanded = new Set(expandedRfqs);
    if (newExpanded.has(rfqId)) {
      newExpanded.delete(rfqId);
    } else {
      newExpanded.add(rfqId);
    }
    setExpandedRfqs(newExpanded);
  };

  const getConfirmation = (quoteId: string): QuoteConfirmation | undefined => {
    return confirmations.get(quoteId);
  };

  const setConfirmation = (quoteId: string, conf: Partial<QuoteConfirmation>) => {
    const existing = confirmations.get(quoteId) || { quoteId, action: 'confirm' as ConfirmationAction };
    setConfirmations(new Map(confirmations.set(quoteId, { ...existing, ...conf })));
  };

  const handleSubmitRfqConfirmations = (rfqId: string, quotes: NonNullable<typeof data>['rfqs'][0]['quotes']) => {
    const rfqConfirmations = quotes
      .map((q) => confirmations.get(q.quoteId))
      .filter((c): c is QuoteConfirmation => c !== undefined);

    if (rfqConfirmations.length === 0) {
      toast.warning('Please select a response for at least one quote');
      return;
    }

    // Validate update actions
    for (const conf of rfqConfirmations) {
      if (conf.action === 'update' && !conf.updatedPriceUsd && !conf.updatedAvailableQty) {
        toast.error('Please provide updated price or quantity for update actions');
        return;
      }
      if (conf.action === 'update' && !conf.reason) {
        toast.error('Please provide a reason for the update');
        return;
      }
      if (conf.action === 'reject' && !conf.reason) {
        toast.error('Please provide a reason for rejection');
        return;
      }
    }

    setSubmittingRfqId(rfqId);
    submitConfirmations({
      rfqId,
      confirmations: rfqConfirmations,
    });
  };

  // Auto-expand all RFQs on load
  if (data && expandedRfqs.size === 0 && data.rfqs.length > 0) {
    setExpandedRfqs(new Set(data.rfqs.map((r) => r.rfqId)));
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-fill-muted rounded w-48 mb-4" />
                <div className="space-y-3">
                  <div className="h-20 bg-fill-muted rounded" />
                  <div className="h-20 bg-fill-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const hasNoPending = !data || data.pendingCount === 0;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-4 sm:py-8">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/platform/partner/source">
            <Button variant="ghost" size="sm" className="p-1.5">
              <ButtonContent iconLeft={IconArrowLeft} />
            </Button>
          </Link>
          <div>
            <Typography variant="headingLg" className="text-lg sm:text-xl">
              Quote Confirmations
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              Confirm your selected quotes are still available
            </Typography>
          </div>
        </div>

        {/* Info banner */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <IconClock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Why confirm?</p>
              <p className="text-blue-700">
                Your quotes were selected by the client. Please confirm availability and pricing
                are still valid, or update if there have been any changes.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Empty state */}
        {hasNoPending && (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center">
              <IconInbox className="h-12 w-12 text-text-muted mx-auto mb-4" />
              <Typography variant="headingSm" className="mb-2">
                No pending confirmations
              </Typography>
              <Typography variant="bodyMd" colorRole="muted" className="max-w-sm mx-auto mb-4">
                You don&apos;t have any quotes waiting for confirmation right now.
              </Typography>
              <Link href="/platform/partner/source">
                <Button variant="outline" size="sm">
                  <ButtonContent iconLeft={IconArrowLeft}>Back to RFQs</ButtonContent>
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Pending confirmations by RFQ */}
        {data && data.rfqs.map((rfq) => {
          const isExpanded = expandedRfqs.has(rfq.rfqId);
          const rfqConfirmationsCount = rfq.quotes.filter((q) => confirmations.has(q.quoteId)).length;
          const allConfirmed = rfqConfirmationsCount === rfq.quotes.length;
          const isThisSubmitting = submittingRfqId === rfq.rfqId;

          return (
            <Card key={rfq.rfqId} className="overflow-hidden">
              {/* RFQ Header */}
              <div
                className="px-4 py-3 bg-fill-muted/30 border-b border-border-muted cursor-pointer hover:bg-fill-muted/50 transition-colors"
                onClick={() => toggleRfqExpanded(rfq.rfqId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-medium text-text-muted bg-fill-muted px-2 py-0.5 rounded">
                      {rfq.rfqNumber}
                    </span>
                    <Typography variant="bodyMd" className="font-semibold">
                      {rfq.rfqName}
                    </Typography>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-muted">
                      {rfq.quotes.length} quote{rfq.quotes.length !== 1 ? 's' : ''}
                    </span>
                    {rfqConfirmationsCount > 0 && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        allConfirmed
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {rfqConfirmationsCount}/{rfq.quotes.length} ready
                      </span>
                    )}
                    {isExpanded ? (
                      <IconChevronUp className="h-5 w-5 text-text-muted" />
                    ) : (
                      <IconChevronDown className="h-5 w-5 text-text-muted" />
                    )}
                  </div>
                </div>
                {rfq.confirmationRequestedAt && (
                  <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                    Requested {formatDistanceToNow(new Date(rfq.confirmationRequestedAt), { addSuffix: true })}
                  </Typography>
                )}
              </div>

              {/* Quote list */}
              {isExpanded && (
                <CardContent className="p-4 space-y-4">
                  {rfq.quotes.map((quote) => {
                    const conf = getConfirmation(quote.quoteId);
                    const action = conf?.action || null;

                    return (
                      <div
                        key={quote.quoteId}
                        className={`rounded-lg border p-4 transition-all ${
                          action === 'confirm'
                            ? 'border-green-300 bg-green-50/50'
                            : action === 'update'
                              ? 'border-amber-300 bg-amber-50/50'
                              : action === 'reject'
                                ? 'border-red-300 bg-red-50/50'
                                : 'border-border-muted'
                        }`}
                      >
                        {/* Quote info */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                          <div className="space-y-1">
                            <Typography variant="bodyMd" className="font-semibold">
                              {quote.productName}
                            </Typography>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
                              {quote.producer && <span>{quote.producer}</span>}
                              {quote.vintage && (
                                <span className="px-1.5 py-0.5 bg-fill-brand/10 text-text-brand rounded text-xs font-medium">
                                  {quote.vintage}
                                </span>
                              )}
                              <span>·</span>
                              <span>{quote.quantity} {quote.quantityUnit === 'bottles' ? 'btl' : 'cs'}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-text-primary">
                              ${quote.costPricePerCaseUsd?.toFixed(2)}/cs
                            </div>
                            <div className="text-xs text-text-muted">
                              {quote.availableQuantity} available · {quote.leadTimeDays || '?'}d lead
                            </div>
                            {quote.createdAt && (
                              <div className="text-xs text-text-muted mt-1">
                                Quoted {format(new Date(quote.createdAt), 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmation(quote.quoteId, { action: 'confirm' })}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                action === 'confirm'
                                  ? 'bg-green-600 text-white shadow-md'
                                  : 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
                              }`}
                            >
                              <IconCheck className="h-4 w-4" />
                              Confirm As-Is
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmation(quote.quoteId, { action: 'update' })}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                action === 'update'
                                  ? 'bg-amber-500 text-white shadow-md'
                                  : 'bg-white border border-amber-300 text-amber-700 hover:bg-amber-50'
                              }`}
                            >
                              <IconAlertTriangle className="h-4 w-4" />
                              Update
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmation(quote.quoteId, { action: 'reject' })}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                action === 'reject'
                                  ? 'bg-red-600 text-white shadow-md'
                                  : 'bg-white border border-red-300 text-red-700 hover:bg-red-50'
                              }`}
                            >
                              <IconX className="h-4 w-4" />
                              Reject
                            </button>
                          </div>

                          {/* Update fields */}
                          {action === 'update' && (
                            <div className="p-3 bg-amber-100/50 rounded-lg space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-amber-800 mb-1">
                                    New Price (USD/case)
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-amber-700">$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder={quote.costPricePerCaseUsd?.toString()}
                                      value={conf?.updatedPriceUsd || ''}
                                      onChange={(e) => setConfirmation(quote.quoteId, {
                                        updatedPriceUsd: parseFloat(e.target.value) || undefined,
                                      })}
                                      className="w-full rounded border border-amber-300 bg-white pl-6 pr-2 py-2 text-sm"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-amber-800 mb-1">
                                    New Available Qty
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder={quote.availableQuantity?.toString()}
                                    value={conf?.updatedAvailableQty || ''}
                                    onChange={(e) => setConfirmation(quote.quoteId, {
                                      updatedAvailableQty: parseInt(e.target.value) || undefined,
                                    })}
                                    className="w-full rounded border border-amber-300 bg-white px-2 py-2 text-sm"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-amber-800 mb-1">
                                  Reason for update *
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g., Supplier price increase, stock reduced"
                                  value={conf?.reason || ''}
                                  onChange={(e) => setConfirmation(quote.quoteId, { reason: e.target.value })}
                                  className="w-full rounded border border-amber-300 bg-white px-2 py-2 text-sm"
                                />
                              </div>
                            </div>
                          )}

                          {/* Reject reason */}
                          {action === 'reject' && (
                            <div className="p-3 bg-red-100/50 rounded-lg">
                              <label className="block text-xs font-medium text-red-800 mb-1">
                                Reason for rejection *
                              </label>
                              <input
                                type="text"
                                placeholder="e.g., Stock sold, item discontinued"
                                value={conf?.reason || ''}
                                onChange={(e) => setConfirmation(quote.quoteId, { reason: e.target.value })}
                                className="w-full rounded border border-red-300 bg-white px-2 py-2 text-sm"
                              />
                            </div>
                          )}

                          {/* Optional notes for confirm */}
                          {action === 'confirm' && (
                            <div className="p-3 bg-green-100/50 rounded-lg">
                              <label className="block text-xs font-medium text-green-800 mb-1">
                                Notes (optional)
                              </label>
                              <input
                                type="text"
                                placeholder="Any additional notes..."
                                value={conf?.notes || ''}
                                onChange={(e) => setConfirmation(quote.quoteId, { notes: e.target.value })}
                                className="w-full rounded border border-green-300 bg-white px-2 py-2 text-sm"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Submit button for this RFQ */}
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="default"
                      colorRole="brand"
                      onClick={() => handleSubmitRfqConfirmations(rfq.rfqId, rfq.quotes)}
                      isDisabled={isSubmitting || rfqConfirmationsCount === 0}
                    >
                      <ButtonContent iconLeft={IconCheck}>
                        {isThisSubmitting
                          ? 'Submitting...'
                          : `Submit ${rfqConfirmationsCount} Confirmation${rfqConfirmationsCount !== 1 ? 's' : ''}`
                        }
                      </ButtonContent>
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PartnerConfirmationsPage;
