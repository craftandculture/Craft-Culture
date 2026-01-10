'use client';

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconFilter,
  IconInfoCircle,
  IconSend,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import QuoteExcelUpload from '@/app/_source/components/QuoteExcelUpload';
import RfqStatusBadge from '@/app/_source/components/RfqStatusBadge';
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
  const [showUnquotedOnly, setShowUnquotedOnly] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [entryMode, setEntryMode] = useState<'manual' | 'excel'>('manual');

  // Auto-save key for localStorage
  const storageKey = `source-rfq-draft-${rfqId}`;

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(storageKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft) as {
          quotes: [string, QuoteEntry][];
          partnerNotes: string;
          savedAt: string;
        };
        setQuotes(new Map(parsed.quotes));
        setPartnerNotes(parsed.partnerNotes || '');
        setLastSavedAt(new Date(parsed.savedAt));
      }
    } catch {
      // Ignore parse errors
    }
  }, [storageKey]);

  // Auto-save draft to localStorage
  const saveDraft = useCallback(() => {
    try {
      const draft = {
        quotes: Array.from(quotes.entries()),
        partnerNotes,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setLastSavedAt(new Date());
    } catch {
      // Ignore storage errors
    }
  }, [quotes, partnerNotes, storageKey]);

  // Auto-save when quotes or notes change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (quotes.size > 0 || partnerNotes) {
        saveDraft();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [quotes, partnerNotes, saveDraft]);

  // Clear draft on successful submission
  const clearDraft = () => {
    try {
      localStorage.removeItem(storageKey);
      setLastSavedAt(null);
    } catch {
      // Ignore storage errors
    }
  };

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
        clearDraft();
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

  // Filter items
  const filteredItems = showUnquotedOnly
    ? rfq.items.filter((item) => {
        const quote = quotes.get(item.id);
        if (!quote) return true;
        if (quote.quoteType === 'not_available') return false;
        return !quote.costPricePerCaseUsd || quote.costPricePerCaseUsd <= 0;
      })
    : rfq.items;

  // Handle parsed quotes from Excel upload
  const handleExcelQuotesParsed = (parsedQuotes: ParsedQuote[]) => {
    const newQuotes = new Map<string, QuoteEntry>();

    for (const parsed of parsedQuotes) {
      const quoteEntry: QuoteEntry = {
        itemId: parsed.itemId,
        quoteType: parsed.quoteType,
        costPricePerCaseUsd: parsed.costPricePerCaseUsd,
        currency: 'USD',
        availableQuantity: parsed.availableQuantity,
        leadTimeDays: parsed.leadTimeDays,
        stockLocation: parsed.stockLocation,
        notes: parsed.notes,
        notAvailableReason: parsed.notAvailableReason,
        alternativeProductName: parsed.alternativeProductName,
        alternativeProducer: parsed.alternativeProducer,
        alternativeVintage: parsed.alternativeVintage,
        alternativeReason: parsed.alternativeReason,
      };
      newQuotes.set(parsed.itemId, quoteEntry);
    }

    setQuotes(newQuotes);
    setEntryMode('manual'); // Switch back to manual to review/edit
    // Expand all items so user can review
    setExpandedItems(new Set(parsedQuotes.map((q) => q.itemId)));
  };

  // Copy quote template from one item to others
  const handleCopyQuoteToAll = (sourceItemId: string) => {
    const sourceQuote = quotes.get(sourceItemId);
    if (!sourceQuote) return;

    const newQuotes = new Map(quotes);
    for (const item of rfq.items) {
      if (item.id !== sourceItemId && !quotes.has(item.id)) {
        newQuotes.set(item.id, {
          itemId: item.id,
          quoteType: sourceQuote.quoteType,
          currency: sourceQuote.currency,
          caseConfig: sourceQuote.caseConfig,
          stockLocation: sourceQuote.stockLocation,
          stockCondition: sourceQuote.stockCondition,
          leadTimeDays: sourceQuote.leadTimeDays,
          validUntil: sourceQuote.validUntil,
        });
      }
    }
    setQuotes(newQuotes);
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-4 sm:py-8 pb-28 sm:pb-8">
      <div className="space-y-4 sm:space-y-6">
        {/* Header - Compact for mobile */}
        <div className="space-y-3">
          {/* Back + RFQ number */}
          <div className="flex items-center gap-3">
            <Link href="/platform/partner/source">
              <Button variant="ghost" size="sm" className="p-1.5">
                <ButtonContent iconLeft={IconArrowLeft} />
              </Button>
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-text-muted">
                {rfq.rfqNumber}
              </span>
              <RfqStatusBadge status={rfq.status} />
            </div>
          </div>

          {/* Title + Deadline */}
          <div>
            <Typography variant="headingLg" className="text-lg sm:text-xl">
              {rfq.name}
            </Typography>
            {rfq.responseDeadline && (
              <div className={`flex items-center gap-1.5 mt-1 text-sm ${
                isDeadlinePassed
                  ? 'text-red-600'
                  : new Date(rfq.responseDeadline) < new Date(Date.now() + 24 * 60 * 60 * 1000)
                    ? 'text-amber-600'
                    : 'text-text-muted'
              }`}>
                <IconCalendar className="h-4 w-4" />
                <span>
                  {isDeadlinePassed
                    ? 'Deadline passed'
                    : `Due ${formatDistanceToNow(new Date(rfq.responseDeadline), { addSuffix: true })}`
                  }
                </span>
                <span className="hidden sm:inline text-text-muted">
                  ({format(new Date(rfq.responseDeadline), 'MMM d, yyyy')})
                </span>
              </div>
            )}
          </div>

          {/* Desktop action buttons */}
          {canSubmit && (
            <div className="hidden sm:flex items-center gap-2">
              <Button
                variant="outline"
                colorRole="danger"
                size="sm"
                onClick={() => setIsDeclineDialogOpen(true)}
              >
                <ButtonContent iconLeft={IconX}>Decline RFQ</ButtonContent>
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

        {/* Progress indicator - Desktop only, mobile uses sticky bar */}
        {canSubmit && (
          <div className="hidden sm:block">
            <Card className="border-border-brand bg-fill-brand/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <IconInfoCircle className="h-5 w-5 text-text-brand flex-shrink-0" />
                    <Typography variant="bodyMd">
                      <span className="font-semibold">{completedCount}</span> of{' '}
                      <span className="font-semibold">{rfq.items.length}</span> items quoted
                    </Typography>
                    {lastSavedAt && (
                      <span className="text-xs text-green-600 ml-2">
                        Draft saved {formatDistanceToNow(lastSavedAt, { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <button
                      type="button"
                      onClick={() => setShowUnquotedOnly(!showUnquotedOnly)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        showUnquotedOnly
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/50 text-text-primary hover:bg-white'
                      }`}
                    >
                      <IconFilter className="h-3.5 w-3.5" />
                      {showUnquotedOnly ? 'Show All' : 'Unquoted Only'}
                    </button>
                    <div className="w-px h-4 bg-border-muted" />
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-green-500" />
                      Quoted
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-500" />
                      N/A
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-gray-300" />
                      Pending
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Mobile progress summary */}
        {canSubmit && (
          <div className="sm:hidden space-y-2">
            <div className="flex items-center justify-between px-1 text-sm">
              <span className="text-text-muted">
                <span className="font-semibold text-text-primary">{completedCount}</span>/{rfq.items.length} quoted
              </span>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {Array.from(quotes.values()).filter((q) => q.quoteType !== 'not_available' && q.costPricePerCaseUsd && q.costPricePerCaseUsd > 0).length}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {Array.from(quotes.values()).filter((q) => q.quoteType === 'not_available').length}
                </span>
              </div>
            </div>
            {/* Filter + Auto-save indicator */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setShowUnquotedOnly(!showUnquotedOnly)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  showUnquotedOnly
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-fill-muted text-text-muted'
                }`}
              >
                <IconFilter className="h-3 w-3" />
                {showUnquotedOnly ? 'Show All' : 'Unquoted Only'}
              </button>
              {lastSavedAt && (
                <span className="text-[10px] text-green-600">
                  Draft saved {formatDistanceToNow(lastSavedAt, { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
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

        {/* Entry Mode Toggle */}
        {canSubmit && (
          <div className="flex items-center gap-2 border-b border-border-muted pb-2">
            <button
              type="button"
              onClick={() => setEntryMode('manual')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                entryMode === 'manual'
                  ? 'bg-fill-brand text-text-on-brand'
                  : 'bg-fill-muted text-text-muted hover:bg-fill-muted/80'
              }`}
            >
              Manual Entry
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('excel')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                entryMode === 'excel'
                  ? 'bg-fill-brand text-text-on-brand'
                  : 'bg-fill-muted text-text-muted hover:bg-fill-muted/80'
              }`}
            >
              <IconUpload className="h-4 w-4" />
              Upload Excel
            </button>
          </div>
        )}

        {/* Excel Upload Section */}
        {canSubmit && entryMode === 'excel' && (
          <Card>
            <CardContent className="p-4">
              <QuoteExcelUpload
                rfqId={rfqId}
                items={rfq.items.map((item) => ({
                  id: item.id,
                  productName: item.productName,
                  producer: item.producer,
                  vintage: item.vintage,
                  quantity: item.quantity,
                  sortOrder: rfq.items.indexOf(item),
                }))}
                onQuotesParsed={handleExcelQuotesParsed}
                onCancel={() => setEntryMode('manual')}
                showDownloadTemplate={true}
              />
            </CardContent>
          </Card>
        )}

        {/* Items to quote - Compact table-like layout */}
        {entryMode === 'manual' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Typography variant="headingSm">
              {showUnquotedOnly
                ? `Remaining Items (${filteredItems.length})`
                : `Items to Quote (${rfq.items.length})`}
            </Typography>
            {showUnquotedOnly && filteredItems.length === 0 && (
              <button
                type="button"
                onClick={() => setShowUnquotedOnly(false)}
                className="text-sm text-blue-600 hover:underline"
              >
                Show all items
              </button>
            )}
          </div>

          {/* Table header for desktop */}
          <div className="hidden lg:grid lg:grid-cols-[auto_1fr_100px_100px_120px_80px] gap-2 px-3 py-2 bg-fill-muted rounded-t-lg text-xs font-semibold text-text-muted border-b border-border-muted">
            <span className="w-8">#</span>
            <span>Product</span>
            <span className="text-center">Qty</span>
            <span className="text-center">Region</span>
            <span className="text-right">Price/case</span>
            <span className="text-center">Status</span>
          </div>

          <div className="divide-y divide-border-muted border border-border-muted rounded-lg lg:rounded-t-none overflow-hidden">
            {filteredItems.map((item, index) => {
              const quote = getQuoteForItem(item.id);
              const existingQuote = item.myQuote;
              const isExpanded = expandedItems.has(item.id);
              const status = getQuoteStatus(item.id);
              const isNA = quote?.quoteType === 'not_available';
              const isAlternative = quote?.quoteType === 'alternative';

              return (
                <div
                  key={item.id}
                  className={`transition-all ${
                    status === 'complete'
                      ? 'bg-green-50/50'
                      : status === 'na'
                        ? 'bg-red-50/50'
                        : 'bg-white'
                  }`}
                >
                  {/* Compact row - always visible */}
                  <div
                    className="px-2 sm:px-3 py-2 cursor-pointer hover:bg-fill-muted/30 transition-colors"
                    onClick={() => canSubmit && toggleItemExpanded(item.id)}
                  >
                    {/* Desktop: Table row layout */}
                    <div className="hidden lg:grid lg:grid-cols-[auto_1fr_100px_100px_120px_80px] gap-2 items-center">
                      {/* Item Number */}
                      <span className="w-8 h-6 rounded bg-fill-brand/10 text-text-brand text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>

                      {/* Product Name + Vintage */}
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {item.productName}
                        </span>
                        {item.vintage && (
                          <span className="flex-shrink-0 text-xs font-semibold text-text-brand bg-fill-brand/10 px-1.5 py-0.5 rounded">
                            {item.vintage}
                          </span>
                        )}
                        {item.adminNotes && (
                          <IconInfoCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" title={item.adminNotes} />
                        )}
                      </div>

                      {/* Quantity */}
                      <span className="text-xs text-center font-medium">
                        {item.quantity} {item.quantityUnit === 'bottles' ? 'btl' : 'cs'}
                      </span>

                      {/* Region */}
                      <span className="text-xs text-center text-text-muted truncate" title={item.region || ''}>
                        {item.region || '-'}
                      </span>

                      {/* Price Input */}
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {canSubmit && !isNA ? (
                          <>
                            <span className="text-xs text-text-muted">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={quote?.costPricePerCaseUsd || ''}
                              onChange={(e) => handleQuoteChange(item.id, 'costPricePerCaseUsd', parseFloat(e.target.value) || 0)}
                              className={`w-20 px-2 py-1 rounded border text-xs text-right font-medium ${
                                status === 'complete'
                                  ? 'border-green-300 bg-green-100 text-green-700'
                                  : 'border-border-primary bg-white'
                              }`}
                            />
                          </>
                        ) : (
                          <span className="text-xs font-medium text-text-muted">
                            {existingQuote?.costPricePerCaseUsd ? `$${existingQuote.costPricePerCaseUsd.toFixed(2)}` : '-'}
                          </span>
                        )}
                      </div>

                      {/* Status + Actions */}
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {status === 'complete' && (
                          <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                            <IconCheck className="h-3 w-3 text-white" />
                          </span>
                        )}
                        {status === 'na' && (
                          <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-medium">
                            N/A
                          </span>
                        )}
                        {canSubmit && status !== 'na' && status !== 'complete' && (
                          <button
                            type="button"
                            onClick={() => handleQuoteChange(item.id, 'quoteType', 'not_available')}
                            className="px-1.5 py-0.5 rounded border border-red-200 text-red-600 text-[10px] font-medium hover:bg-red-50"
                            title="Mark as Not Available"
                          >
                            N/A
                          </button>
                        )}
                        {canSubmit && (
                          <button type="button" className="p-0.5 hover:bg-fill-muted rounded">
                            {isExpanded ? (
                              <IconChevronUp className="h-4 w-4 text-text-muted" />
                            ) : (
                              <IconChevronDown className="h-4 w-4 text-text-muted" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mobile: Compact card layout */}
                    <div className="lg:hidden flex items-start gap-2">
                      {/* Item Number */}
                      <span className="flex-shrink-0 w-6 h-6 rounded bg-fill-brand/10 text-text-brand text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-sm">{item.productName}</span>
                          {item.vintage && (
                            <span className="text-xs font-semibold text-text-brand bg-fill-brand/10 px-1 py-0.5 rounded">
                              {item.vintage}
                            </span>
                          )}
                          {status === 'complete' && (
                            <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                              <IconCheck className="h-2.5 w-2.5 text-white" />
                            </span>
                          )}
                          {status === 'na' && (
                            <span className="px-1 py-0.5 rounded bg-red-500 text-white text-[10px] font-medium">N/A</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                          <span className="font-medium text-text-primary">
                            {item.quantity} {item.quantityUnit === 'bottles' ? 'btl' : 'cs'}
                          </span>
                          {item.region && (
                            <>
                              <span>·</span>
                              <span>{item.region}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Price Input - Mobile */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {canSubmit && !isNA ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="$"
                            value={quote?.costPricePerCaseUsd || ''}
                            onChange={(e) => handleQuoteChange(item.id, 'costPricePerCaseUsd', parseFloat(e.target.value) || 0)}
                            className={`w-16 px-1.5 py-1 rounded border text-xs text-right font-medium ${
                              status === 'complete'
                                ? 'border-green-300 bg-green-100 text-green-700'
                                : 'border-border-primary bg-white'
                            }`}
                          />
                        ) : existingQuote?.costPricePerCaseUsd ? (
                          <span className="text-xs font-medium text-green-700">
                            ${existingQuote.costPricePerCaseUsd.toFixed(0)}
                          </span>
                        ) : null}
                      </div>

                      {/* Expand Button - Mobile */}
                      {canSubmit && (
                        <button type="button" className="flex-shrink-0 p-1 hover:bg-fill-muted rounded">
                          {isExpanded ? (
                            <IconChevronUp className="h-4 w-4 text-text-muted" />
                          ) : (
                            <IconChevronDown className="h-4 w-4 text-text-muted" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quote Input Section - Expanded (compact) */}
                  {canSubmit && isExpanded && (
                    <div className="border-t border-border-muted bg-fill-secondary/30 px-3 py-3 space-y-3">
                      {/* Response Type + Quick Actions Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-text-muted">Type:</span>
                        {[
                          { value: 'exact', label: 'Exact', color: 'bg-green-100 border-green-300 text-green-800' },
                          { value: 'alternative', label: 'Alt', color: 'bg-amber-100 border-amber-300 text-amber-800' },
                          { value: 'not_available', label: 'N/A', color: 'bg-red-100 border-red-300 text-red-800' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleQuoteChange(item.id, 'quoteType', option.value as QuoteType)}
                            className={`px-2 py-1 rounded border text-xs font-medium transition-all ${
                              quote?.quoteType === option.value
                                ? option.color
                                : 'bg-white border-border-muted text-text-muted hover:border-border-primary'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                        {status === 'complete' && (
                          <button
                            type="button"
                            onClick={() => handleCopyQuoteToAll(item.id)}
                            className="ml-auto flex items-center gap-1 px-2 py-1 rounded border border-border-muted text-xs text-text-muted hover:bg-fill-muted"
                            title="Copy settings to unquoted items"
                          >
                            <IconCopy className="h-3 w-3" />
                            Copy to all
                          </button>
                        )}
                      </div>

                      {/* N/A Reason - Compact */}
                      {isNA && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium text-red-700">Reason:</span>
                            {NA_REASONS.slice(0, 4).map((reason) => (
                              <button
                                key={reason.value}
                                type="button"
                                onClick={() => handleQuoteChange(item.id, 'notAvailableReason', reason.label)}
                                className={`px-2 py-0.5 rounded text-xs transition-all ${
                                  quote?.notAvailableReason === reason.label
                                    ? 'bg-red-600 text-white'
                                    : 'bg-white border border-red-200 text-red-700 hover:bg-red-100'
                                }`}
                              >
                                {reason.label}
                              </button>
                            ))}
                            <input
                              type="text"
                              placeholder="Other..."
                              value={NA_REASONS.some((r) => r.label === quote?.notAvailableReason) ? '' : quote?.notAvailableReason || ''}
                              onChange={(e) => handleQuoteChange(item.id, 'notAvailableReason', e.target.value)}
                              className="flex-1 min-w-[100px] px-2 py-0.5 rounded border border-red-200 bg-white text-xs"
                            />
                          </div>
                        </div>
                      )}

                      {/* Pricing & Stock - Compact single row */}
                      {!isNA && (
                        <>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {/* Price */}
                            <div>
                              <label className="block text-[10px] font-medium text-text-muted mb-0.5">Price*</label>
                              <div className="relative">
                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={quote?.costPricePerCaseUsd || ''}
                                  onChange={(e) => handleQuoteChange(item.id, 'costPricePerCaseUsd', parseFloat(e.target.value) || 0)}
                                  className="w-full rounded border border-border-primary bg-white pl-5 pr-1 py-1.5 text-xs text-right font-medium"
                                />
                              </div>
                            </div>

                            {/* Case Config */}
                            <div>
                              <label className="block text-[10px] font-medium text-text-muted mb-0.5">Config</label>
                              <select
                                value={quote?.caseConfig || ''}
                                onChange={(e) => handleQuoteChange(item.id, 'caseConfig', e.target.value)}
                                className="w-full rounded border border-border-primary bg-white px-1 py-1.5 text-xs"
                              >
                                <option value="">-</option>
                                {CASE_CONFIGS.slice(0, 4).map((c) => (
                                  <option key={c.value} value={c.value}>{c.value}pk</option>
                                ))}
                              </select>
                            </div>

                            {/* Available Qty */}
                            <div>
                              <label className="block text-[10px] font-medium text-text-muted mb-0.5">Avail</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="qty"
                                value={quote?.availableQuantity || ''}
                                onChange={(e) => handleQuoteChange(item.id, 'availableQuantity', parseInt(e.target.value) || 0)}
                                className="w-full rounded border border-border-primary bg-white px-1.5 py-1.5 text-xs"
                              />
                            </div>

                            {/* Location */}
                            <div>
                              <label className="block text-[10px] font-medium text-text-muted mb-0.5">Location</label>
                              <select
                                value={quote?.stockLocation || ''}
                                onChange={(e) => handleQuoteChange(item.id, 'stockLocation', e.target.value)}
                                className="w-full rounded border border-border-primary bg-white px-1 py-1.5 text-xs"
                              >
                                <option value="">-</option>
                                {STOCK_LOCATIONS.slice(0, 5).map((l) => (
                                  <option key={l.value} value={l.value}>{l.label.replace(' (Bonded)', '')}</option>
                                ))}
                              </select>
                            </div>

                            {/* Condition */}
                            <div>
                              <label className="block text-[10px] font-medium text-text-muted mb-0.5">Cond.</label>
                              <select
                                value={quote?.stockCondition || ''}
                                onChange={(e) => handleQuoteChange(item.id, 'stockCondition', e.target.value)}
                                className="w-full rounded border border-border-primary bg-white px-1 py-1.5 text-xs"
                              >
                                <option value="">-</option>
                                {STOCK_CONDITIONS.map((c) => (
                                  <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                              </select>
                            </div>

                            {/* Lead Time */}
                            <div>
                              <label className="block text-[10px] font-medium text-text-muted mb-0.5">Lead</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="days"
                                  value={quote?.leadTimeDays || ''}
                                  onChange={(e) => handleQuoteChange(item.id, 'leadTimeDays', parseInt(e.target.value) || 0)}
                                  className="w-full rounded border border-border-primary bg-white px-1.5 pr-5 py-1.5 text-xs"
                                />
                                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">d</span>
                              </div>
                            </div>
                          </div>

                          {/* Alternative Product Details - Compact */}
                          {isAlternative && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded space-y-2">
                              <span className="text-xs font-semibold text-amber-800">Alternative Product</span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div>
                                  <label className="block text-[10px] font-medium text-amber-700 mb-0.5">Name*</label>
                                  <input
                                    type="text"
                                    placeholder="Product name"
                                    value={quote?.alternativeProductName || ''}
                                    onChange={(e) => handleQuoteChange(item.id, 'alternativeProductName', e.target.value)}
                                    className="w-full rounded border border-amber-300 bg-white px-1.5 py-1 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium text-amber-700 mb-0.5">Producer</label>
                                  <input
                                    type="text"
                                    placeholder="Producer"
                                    value={quote?.alternativeProducer || ''}
                                    onChange={(e) => handleQuoteChange(item.id, 'alternativeProducer', e.target.value)}
                                    className="w-full rounded border border-amber-300 bg-white px-1.5 py-1 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium text-amber-700 mb-0.5">Vintage</label>
                                  <input
                                    type="text"
                                    placeholder="2020"
                                    value={quote?.alternativeVintage || ''}
                                    onChange={(e) => handleQuoteChange(item.id, 'alternativeVintage', e.target.value)}
                                    className="w-full rounded border border-amber-300 bg-white px-1.5 py-1 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium text-amber-700 mb-0.5">Region</label>
                                  <input
                                    type="text"
                                    placeholder="Region"
                                    value={quote?.alternativeRegion || ''}
                                    onChange={(e) => handleQuoteChange(item.id, 'alternativeRegion', e.target.value)}
                                    className="w-full rounded border border-amber-300 bg-white px-1.5 py-1 text-xs"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                <div>
                                  <label className="block text-[10px] font-medium text-amber-700 mb-0.5">Country</label>
                                  <input
                                    type="text"
                                    placeholder="Country"
                                    value={quote?.alternativeCountry || ''}
                                    onChange={(e) => handleQuoteChange(item.id, 'alternativeCountry', e.target.value)}
                                    className="w-full rounded border border-amber-300 bg-white px-1.5 py-1 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium text-amber-700 mb-0.5">Size</label>
                                  <select
                                    value={quote?.alternativeBottleSize || ''}
                                    onChange={(e) => handleQuoteChange(item.id, 'alternativeBottleSize', e.target.value)}
                                    className="w-full rounded border border-amber-300 bg-white px-1 py-1 text-xs"
                                  >
                                    <option value="">-</option>
                                    {BOTTLE_SIZES.map((s) => (
                                      <option key={s.value} value={s.value}>{s.value}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium text-amber-700 mb-0.5">Config</label>
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="6"
                                    value={quote?.alternativeCaseConfig || ''}
                                    onChange={(e) => handleQuoteChange(item.id, 'alternativeCaseConfig', parseInt(e.target.value) || 0)}
                                    className="w-full rounded border border-amber-300 bg-white px-1.5 py-1 text-xs"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <label className="block text-[10px] font-medium text-amber-700 mb-0.5">LWIN</label>
                                  <input
                                    type="text"
                                    placeholder="Optional"
                                    value={quote?.alternativeLwin || ''}
                                    onChange={(e) => handleQuoteChange(item.id, 'alternativeLwin', e.target.value)}
                                    className="w-full rounded border border-amber-300 bg-white px-1.5 py-1 text-xs"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-amber-700 mb-0.5">Reason*</label>
                                <input
                                  type="text"
                                  placeholder="Why offering alternative"
                                  value={quote?.alternativeReason || ''}
                                  onChange={(e) => handleQuoteChange(item.id, 'alternativeReason', e.target.value)}
                                  className="w-full rounded border border-amber-300 bg-white px-1.5 py-1 text-xs"
                                />
                              </div>
                            </div>
                          )}

                          {/* Item Notes - Compact */}
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-medium text-text-muted whitespace-nowrap">Notes:</label>
                            <input
                              type="text"
                              placeholder="Item notes (packaging, condition, etc.)"
                              value={quote?.notes || ''}
                              onChange={(e) => handleQuoteChange(item.id, 'notes', e.target.value)}
                              className="flex-1 rounded border border-border-primary bg-white px-2 py-1 text-xs"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Existing quote display (for already submitted) */}
                  {!canSubmit && existingQuote && (
                    <div className="border-t border-border-muted px-3 py-2 bg-fill-muted/30">
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span>
                          <span className="text-text-muted">Quote:</span>{' '}
                          <span className="font-semibold">${existingQuote.costPricePerCaseUsd?.toFixed(2)}/cs</span>
                        </span>
                        {existingQuote.quoteType === 'alternative' && existingQuote.alternativeProductName && (
                          <span className="text-amber-600">Alt: {existingQuote.alternativeProductName}</span>
                        )}
                        {existingQuote.leadTimeDays && (
                          <span className="text-text-muted">{existingQuote.leadTimeDays}d lead</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
            );
          })}
        </div>
        </div>
        )}

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

      {/* Mobile sticky action bar */}
      {canSubmit && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border-primary p-3 sm:hidden safe-area-inset-bottom z-50">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <button
              type="button"
              onClick={() => setIsDeclineDialogOpen(true)}
              className="p-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              aria-label="Decline RFQ"
            >
              <IconX className="h-5 w-5" />
            </button>
            <Button
              variant="default"
              colorRole="brand"
              onClick={handleSubmitQuotes}
              isDisabled={isSubmitting || completedCount === 0}
              className="flex-1"
            >
              <ButtonContent iconLeft={IconSend}>
                {isSubmitting
                  ? 'Submitting...'
                  : completedCount === 0
                    ? 'Quote items to submit'
                    : `Submit ${completedCount} Quote${completedCount !== 1 ? 's' : ''}`
                }
              </ButtonContent>
            </Button>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${(completedCount / rfq.items.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerRfqDetailPage;
