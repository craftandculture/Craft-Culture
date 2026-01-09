'use client';

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconInfoCircle,
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
  costPricePerCaseUsd?: number;
  currency: string;
  caseConfig?: string;
  availableQuantity?: number;
  leadTimeDays?: number;
  stockLocation?: string;
  stockCondition?: string;
  moq?: number;
  validUntil?: Date;
  notes?: string;
  notAvailableReason?: string;
  alternativeProductName?: string;
  alternativeProducer?: string;
  alternativeVintage?: string;
  alternativeRegion?: string;
  alternativeCountry?: string;
  alternativeBottleSize?: string;
  alternativeCaseConfig?: number;
  alternativeLwin?: string;
  alternativeReason?: string;
}

// Common case configurations
const CASE_CONFIGS = [
  { value: '6', label: '6 bottles' },
  { value: '12', label: '12 bottles' },
  { value: '3', label: '3 bottles' },
  { value: '1', label: '1 bottle' },
  { value: '24', label: '24 bottles' },
  { value: 'custom', label: 'Custom...' },
];

// Common stock locations
const STOCK_LOCATIONS = [
  { value: 'uk_bonded', label: 'UK (Bonded)' },
  { value: 'eu_bonded', label: 'EU (Bonded)' },
  { value: 'hk_bonded', label: 'Hong Kong (Bonded)' },
  { value: 'sg_bonded', label: 'Singapore (Bonded)' },
  { value: 'us_bonded', label: 'USA (Bonded)' },
  { value: 'uae', label: 'UAE' },
  { value: 'producer', label: 'At Producer/Château' },
  { value: 'custom', label: 'Other...' },
];

// Stock conditions
const STOCK_CONDITIONS = [
  { value: 'in_bond', label: 'In Bond' },
  { value: 'duty_paid', label: 'Duty Paid' },
  { value: 'ex_works', label: 'Ex-Works' },
  { value: 'free_trade', label: 'Free Trade Zone' },
];

// Common bottle sizes
const BOTTLE_SIZES = [
  { value: '750ml', label: '750ml (Standard)' },
  { value: '375ml', label: '375ml (Half)' },
  { value: '1.5L', label: '1.5L (Magnum)' },
  { value: '3L', label: '3L (Jeroboam)' },
  { value: '6L', label: '6L (Imperial)' },
];

// N/A Reasons
const NA_REASONS = [
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'discontinued', label: 'Discontinued' },
  { value: 'not_in_portfolio', label: 'Not in Portfolio' },
  { value: 'vintage_not_available', label: 'Vintage Not Available' },
  { value: 'minimum_not_met', label: 'Minimum Order Not Met' },
  { value: 'custom', label: 'Other reason...' },
];

/**
 * Partner RFQ detail page - comprehensive quote submission
 */
const PartnerRfqDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const rfqId = params.rfqId as string;
  const api = useTRPC();

  const [quotes, setQuotes] = useState<Map<string, QuoteEntry>>(new Map());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [partnerNotes, setPartnerNotes] = useState('');
  const [isDeclineDialogOpen, setIsDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Fetch RFQ data
  const {
    data: rfq,
    isLoading,
    refetch,
  } = useQuery({
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

  const toggleItemExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleQuoteChange = (
    itemId: string,
    field: keyof QuoteEntry,
    value: string | number | Date | undefined,
  ) => {
    const currentQuote = quotes.get(itemId) || {
      itemId,
      quoteType: 'exact' as QuoteType,
      currency: 'USD',
    };

    setQuotes(new Map(quotes.set(itemId, { ...currentQuote, [field]: value })));

    // Auto-expand when user starts filling in data
    if (!expandedItems.has(itemId)) {
      setExpandedItems(new Set(expandedItems).add(itemId));
    }
  };

  const handleSubmitQuotes = () => {
    const quotesToSubmit = Array.from(quotes.values()).filter((q) => {
      // N/A quotes are valid without a price
      if (q.quoteType === 'not_available') {
        return true;
      }
      // Exact and alternative quotes need a price
      return q.costPricePerCaseUsd && q.costPricePerCaseUsd > 0;
    });

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

  const getQuoteStatus = (itemId: string): 'empty' | 'complete' | 'partial' | 'na' => {
    const quote = quotes.get(itemId);
    if (!quote) return 'empty';
    if (quote.quoteType === 'not_available') return 'na';
    if (quote.costPricePerCaseUsd && quote.costPricePerCaseUsd > 0) return 'complete';
    return 'partial';
  };

  const completedCount = Array.from(quotes.values()).filter((q) => {
    if (q.quoteType === 'not_available') return true;
    return q.costPricePerCaseUsd && q.costPricePerCaseUsd > 0;
  }).length;

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
                isDisabled={isSubmitting || completedCount === 0}
              >
                <ButtonContent iconLeft={IconSend}>
                  {isSubmitting ? 'Submitting...' : `Submit ${completedCount} Quote${completedCount !== 1 ? 's' : ''}`}
                </ButtonContent>
              </Button>
            </div>
          )}
        </div>

        {/* Progress indicator */}
        {canSubmit && (
          <Card className="border-border-brand bg-fill-brand/5">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <IconInfoCircle className="h-5 w-5 text-text-brand flex-shrink-0" />
                  <Typography variant="bodyMd">
                    <span className="font-semibold">{completedCount}</span> of{' '}
                    <span className="font-semibold">{rfq.items.length}</span> items quoted
                  </Typography>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm ml-8 sm:ml-0">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500" />
                    Complete
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500" />
                    N/A
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gray-300" />
                    Pending
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status banners */}
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
        <div className="space-y-4">
          <Typography variant="headingSm">
            Items to Quote ({rfq.items.length})
          </Typography>

          {rfq.items.map((item, index) => {
            const quote = getQuoteForItem(item.id);
            const existingQuote = item.myQuote;
            const isExpanded = expandedItems.has(item.id);
            const status = getQuoteStatus(item.id);
            const isNA = quote?.quoteType === 'not_available';
            const isAlternative = quote?.quoteType === 'alternative';

            return (
              <Card
                key={item.id}
                className={`transition-all ${
                  status === 'complete'
                    ? 'border-green-300 bg-green-50/30'
                    : status === 'na'
                      ? 'border-red-300 bg-red-50/30'
                      : 'border-border-muted'
                }`}
              >
                <CardContent className="p-0">
                  {/* Item Header - Request Details */}
                  <div
                    className="p-3 sm:p-4 cursor-pointer hover:bg-fill-muted/50 transition-colors"
                    onClick={() => canSubmit && toggleItemExpanded(item.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Item Number */}
                      <span className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-fill-brand text-text-inverse text-xs sm:text-sm font-bold flex items-center justify-center">
                        {index + 1}
                      </span>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        {/* Product Name + Vintage + Status */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Typography variant="bodyMd" className="font-semibold">
                            {item.productName}
                          </Typography>
                          {item.vintage && (
                            <span className="text-sm font-semibold text-text-brand bg-fill-brand/10 px-2 py-0.5 rounded">
                              {item.vintage}
                            </span>
                          )}
                          {status === 'complete' && (
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                              <IconCheck className="h-3 w-3 text-white" />
                            </span>
                          )}
                          {status === 'na' && (
                            <span className="flex-shrink-0 px-2 py-0.5 rounded bg-red-500 text-white text-xs font-medium">
                              N/A
                            </span>
                          )}
                        </div>

                        {/* Wine Details - Compact Responsive Grid */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm">
                          {item.producer && (
                            <div className="flex items-center gap-1">
                              <span className="text-text-muted">Producer:</span>
                              <span className="font-medium">{item.producer}</span>
                            </div>
                          )}
                          {item.region && (
                            <div className="flex items-center gap-1">
                              <span className="text-text-muted">Region:</span>
                              <span className="font-medium">{item.region}</span>
                            </div>
                          )}
                          {item.country && (
                            <div className="flex items-center gap-1">
                              <span className="text-text-muted">Country:</span>
                              <span className="font-medium">{item.country}</span>
                            </div>
                          )}
                        </div>

                        {/* Format & Quantity - Highlight Box */}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-fill-muted rounded-lg text-xs sm:text-sm">
                            <span className="font-semibold text-text-brand">{item.quantity} cases</span>
                            {item.caseConfig && (
                              <>
                                <span className="text-text-muted">·</span>
                                <span className="text-text-muted">{item.caseConfig}pk</span>
                              </>
                            )}
                            {item.bottleSize && (
                              <>
                                <span className="text-text-muted">·</span>
                                <span className="text-text-muted">{item.bottleSize}</span>
                              </>
                            )}
                          </div>
                          {/* Quick quote entry on mobile */}
                          {quote?.costPricePerCaseUsd && (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs sm:text-sm font-medium">
                              ${quote.costPricePerCaseUsd.toFixed(2)}/case
                            </div>
                          )}
                        </div>

                        {item.adminNotes && (
                          <div className="mt-2 p-2 bg-fill-warning/10 rounded border border-border-warning">
                            <Typography variant="bodyXs" className="text-text-warning">
                              <span className="font-semibold">Note:</span> {item.adminNotes}
                            </Typography>
                          </div>
                        )}
                      </div>

                      {/* Expand Button */}
                      {canSubmit && (
                        <button type="button" className="flex-shrink-0 p-1.5 hover:bg-fill-muted rounded-lg">
                          {isExpanded ? (
                            <IconChevronUp className="h-5 w-5 text-text-muted" />
                          ) : (
                            <IconChevronDown className="h-5 w-5 text-text-muted" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quote Input Section - Expanded */}
                  {canSubmit && isExpanded && (
                    <div className="border-t border-border-muted bg-fill-secondary/30 p-3 sm:p-4 space-y-4">
                      {/* Response Type Selection */}
                      <div>
                        <label className="block text-xs sm:text-sm font-semibold text-text-primary mb-2">
                          Response Type
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 'exact', label: 'Exact', labelFull: 'Exact Match', color: 'bg-green-100 border-green-300 text-green-800' },
                            { value: 'alternative', label: 'Alt', labelFull: 'Alternative', color: 'bg-amber-100 border-amber-300 text-amber-800' },
                            { value: 'not_available', label: 'N/A', labelFull: 'Not Available', color: 'bg-red-100 border-red-300 text-red-800' },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => handleQuoteChange(item.id, 'quoteType', option.value as QuoteType)}
                              className={`px-2 sm:px-4 py-2 rounded-lg border-2 text-xs sm:text-sm font-medium transition-all ${
                                quote?.quoteType === option.value
                                  ? option.color
                                  : 'bg-white border-border-muted text-text-muted hover:border-border-primary'
                              }`}
                            >
                              <span className="sm:hidden">{option.label}</span>
                              <span className="hidden sm:inline">{option.labelFull}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* N/A Reason - Only for N/A quotes */}
                      {isNA && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                          <label className="block text-sm font-semibold text-red-800">
                            Reason Not Available
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {NA_REASONS.map((reason) => (
                              <button
                                key={reason.value}
                                type="button"
                                onClick={() => {
                                  if (reason.value === 'custom') {
                                    handleQuoteChange(item.id, 'notAvailableReason', '');
                                  } else {
                                    handleQuoteChange(item.id, 'notAvailableReason', reason.label);
                                  }
                                }}
                                className={`px-3 py-1.5 rounded border text-sm transition-all ${
                                  quote?.notAvailableReason === reason.label ||
                                  (reason.value === 'custom' && quote?.notAvailableReason && !NA_REASONS.some((r) => r.label === quote.notAvailableReason && r.value !== 'custom'))
                                    ? 'bg-red-600 border-red-600 text-white'
                                    : 'bg-white border-red-300 text-red-700 hover:bg-red-100'
                                }`}
                              >
                                {reason.label}
                              </button>
                            ))}
                          </div>
                          {(quote?.notAvailableReason === '' ||
                            (quote?.notAvailableReason &&
                              !NA_REASONS.some((r) => r.label === quote.notAvailableReason && r.value !== 'custom'))) && (
                            <input
                              type="text"
                              placeholder="Enter custom reason..."
                              value={quote?.notAvailableReason || ''}
                              onChange={(e) => handleQuoteChange(item.id, 'notAvailableReason', e.target.value)}
                              className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm"
                            />
                          )}
                        </div>
                      )}

                      {/* Pricing & Availability - Only for exact/alternative */}
                      {!isNA && (
                        <>
                          {/* Pricing Section */}
                          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <div className="col-span-2 sm:col-span-1">
                              <label className="block text-xs sm:text-sm font-semibold text-text-primary mb-1">
                                Cost Price (USD) <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={quote?.costPricePerCaseUsd || ''}
                                  onChange={(e) =>
                                    handleQuoteChange(item.id, 'costPricePerCaseUsd', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full rounded-lg border border-border-primary bg-white pl-7 pr-12 py-2 text-sm text-right font-medium"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">
                                  /case
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-semibold text-text-primary mb-1">
                                Case Config
                              </label>
                              <select
                                value={
                                  quote?.caseConfig && !CASE_CONFIGS.some((c) => c.value === quote.caseConfig)
                                    ? 'custom'
                                    : quote?.caseConfig || ''
                                }
                                onChange={(e) => {
                                  if (e.target.value === 'custom') {
                                    handleQuoteChange(item.id, 'caseConfig', '');
                                  } else {
                                    handleQuoteChange(item.id, 'caseConfig', e.target.value);
                                  }
                                }}
                                className="w-full rounded-lg border border-border-primary bg-white px-2 sm:px-3 py-2 text-sm"
                              >
                                <option value="">Select...</option>
                                {CASE_CONFIGS.map((config) => (
                                  <option key={config.value} value={config.value}>
                                    {config.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-semibold text-text-primary mb-1">
                                Avail Qty
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="Qty"
                                  value={quote?.availableQuantity || ''}
                                  onChange={(e) =>
                                    handleQuoteChange(item.id, 'availableQuantity', parseInt(e.target.value) || 0)
                                  }
                                  className="w-full rounded-lg border border-border-primary bg-white px-2 sm:px-3 pr-8 sm:pr-12 py-2 text-sm"
                                />
                                <span className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">
                                  cs
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-semibold text-text-primary mb-1">
                                MOQ
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="Min"
                                  value={quote?.moq || ''}
                                  onChange={(e) => handleQuoteChange(item.id, 'moq', parseInt(e.target.value) || 0)}
                                  className="w-full rounded-lg border border-border-primary bg-white px-2 sm:px-3 pr-8 sm:pr-12 py-2 text-sm"
                                />
                                <span className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">
                                  cs
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Stock & Delivery Section */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <div>
                              <label className="block text-xs sm:text-sm font-semibold text-text-primary mb-1">
                                Location
                              </label>
                              <select
                                value={
                                  quote?.stockLocation && !STOCK_LOCATIONS.some((l) => l.value === quote.stockLocation)
                                    ? 'custom'
                                    : quote?.stockLocation || ''
                                }
                                onChange={(e) => {
                                  if (e.target.value === 'custom') {
                                    handleQuoteChange(item.id, 'stockLocation', '');
                                  } else {
                                    handleQuoteChange(item.id, 'stockLocation', e.target.value);
                                  }
                                }}
                                className="w-full rounded-lg border border-border-primary bg-white px-2 sm:px-3 py-2 text-sm"
                              >
                                <option value="">Select...</option>
                                {STOCK_LOCATIONS.map((loc) => (
                                  <option key={loc.value} value={loc.value}>
                                    {loc.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-semibold text-text-primary mb-1">
                                Condition
                              </label>
                              <select
                                value={quote?.stockCondition || ''}
                                onChange={(e) => handleQuoteChange(item.id, 'stockCondition', e.target.value)}
                                className="w-full rounded-lg border border-border-primary bg-white px-2 sm:px-3 py-2 text-sm"
                              >
                                <option value="">Select...</option>
                                {STOCK_CONDITIONS.map((cond) => (
                                  <option key={cond.value} value={cond.value}>
                                    {cond.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-semibold text-text-primary mb-1">
                                Lead Time
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="Days"
                                  value={quote?.leadTimeDays || ''}
                                  onChange={(e) =>
                                    handleQuoteChange(item.id, 'leadTimeDays', parseInt(e.target.value) || 0)
                                  }
                                  className="w-full rounded-lg border border-border-primary bg-white px-2 sm:px-3 pr-10 py-2 text-sm"
                                />
                                <span className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">
                                  days
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs sm:text-sm font-semibold text-text-primary mb-1">
                                Valid Until
                              </label>
                              <input
                                type="date"
                                value={quote?.validUntil ? format(quote.validUntil, 'yyyy-MM-dd') : ''}
                                onChange={(e) =>
                                  handleQuoteChange(
                                    item.id,
                                    'validUntil',
                                    e.target.value ? new Date(e.target.value) : undefined,
                                  )
                                }
                                className="w-full rounded-lg border border-border-primary bg-white px-2 sm:px-3 py-2 text-sm"
                              />
                            </div>
                          </div>

                          {/* Alternative Product Details */}
                          {isAlternative && (
                            <div className="p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3 sm:space-y-4">
                              <Typography variant="bodySm" className="font-semibold text-amber-800">
                                Alternative Product Details
                              </Typography>
                              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-amber-700 mb-1">
                                    Product Name <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Alternative product name"
                                    value={quote?.alternativeProductName || ''}
                                    onChange={(e) =>
                                      handleQuoteChange(item.id, 'alternativeProductName', e.target.value)
                                    }
                                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-amber-700 mb-1">
                                    Producer
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Producer name"
                                    value={quote?.alternativeProducer || ''}
                                    onChange={(e) =>
                                      handleQuoteChange(item.id, 'alternativeProducer', e.target.value)
                                    }
                                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-amber-700 mb-1">
                                    Vintage
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="e.g., 2020"
                                    value={quote?.alternativeVintage || ''}
                                    onChange={(e) =>
                                      handleQuoteChange(item.id, 'alternativeVintage', e.target.value)
                                    }
                                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-amber-700 mb-1">
                                    Region
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="e.g., Burgundy"
                                    value={quote?.alternativeRegion || ''}
                                    onChange={(e) =>
                                      handleQuoteChange(item.id, 'alternativeRegion', e.target.value)
                                    }
                                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-amber-700 mb-1">
                                    Country
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="e.g., France"
                                    value={quote?.alternativeCountry || ''}
                                    onChange={(e) =>
                                      handleQuoteChange(item.id, 'alternativeCountry', e.target.value)
                                    }
                                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-amber-700 mb-1">
                                    Bottle Size
                                  </label>
                                  <select
                                    value={quote?.alternativeBottleSize || ''}
                                    onChange={(e) =>
                                      handleQuoteChange(item.id, 'alternativeBottleSize', e.target.value)
                                    }
                                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
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
                                  <label className="block text-xs font-medium text-amber-700 mb-1">
                                    Case Config (bottles)
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="e.g., 6"
                                    value={quote?.alternativeCaseConfig || ''}
                                    onChange={(e) =>
                                      handleQuoteChange(
                                        item.id,
                                        'alternativeCaseConfig',
                                        parseInt(e.target.value) || 0,
                                      )
                                    }
                                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-amber-700 mb-1">
                                    LWIN (if known)
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="LWIN code"
                                    value={quote?.alternativeLwin || ''}
                                    onChange={(e) =>
                                      handleQuoteChange(item.id, 'alternativeLwin', e.target.value)
                                    }
                                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-amber-700 mb-1">
                                  Reason for Alternative <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                  placeholder="Explain why you're offering an alternative (e.g., original vintage sold out, similar quality at better price)"
                                  value={quote?.alternativeReason || ''}
                                  onChange={(e) =>
                                    handleQuoteChange(item.id, 'alternativeReason', e.target.value)
                                  }
                                  rows={2}
                                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                                />
                              </div>
                            </div>
                          )}

                          {/* Item Notes */}
                          <div>
                            <label className="block text-sm font-semibold text-text-primary mb-1">
                              Notes for this Item
                            </label>
                            <textarea
                              placeholder="Any specific notes about this item (packaging, condition, delivery, etc.)"
                              value={quote?.notes || ''}
                              onChange={(e) => handleQuoteChange(item.id, 'notes', e.target.value)}
                              rows={2}
                              className="w-full rounded-lg border border-border-primary bg-white px-3 py-2 text-sm"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Existing quote display (for already submitted) */}
                  {!canSubmit && existingQuote && (
                    <div className="border-t border-border-muted p-4 bg-fill-muted/30">
                      <div className="flex flex-wrap items-center gap-4">
                        <div>
                          <span className="text-xs text-text-muted">Your Quote:</span>
                          <Typography variant="bodyMd" className="font-semibold">
                            ${existingQuote.costPricePerCaseUsd?.toFixed(2)}/case
                          </Typography>
                        </div>
                        {existingQuote.quoteType === 'alternative' && existingQuote.alternativeProductName && (
                          <div>
                            <span className="text-xs text-text-muted">Alternative:</span>
                            <Typography variant="bodySm" className="text-text-warning">
                              {existingQuote.alternativeProductName}
                            </Typography>
                          </div>
                        )}
                        {existingQuote.leadTimeDays && (
                          <div>
                            <span className="text-xs text-text-muted">Lead Time:</span>
                            <Typography variant="bodySm">{existingQuote.leadTimeDays} days</Typography>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Overall Partner Notes */}
        {canSubmit && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <Typography variant="headingSm">Overall Notes</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Add any general notes about this quote (shipping terms, payment terms, bulk discounts, etc.)
              </Typography>
              <textarea
                value={partnerNotes}
                onChange={(e) => setPartnerNotes(e.target.value)}
                placeholder="E.g., 5% discount available for orders over 10 cases. All prices Ex-Works UK. Payment terms: 30 days net."
                rows={4}
                className="w-full rounded-lg border border-border-primary bg-white px-3 py-2 text-sm"
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
                Are you sure you want to decline this RFQ? You will not be able to submit quotes
                after declining.
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
                  className="w-full rounded-lg border border-border-primary bg-white px-3 py-2 text-sm"
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
                <ButtonContent>{isDeclining ? 'Declining...' : 'Decline RFQ'}</ButtonContent>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PartnerRfqDetailPage;
