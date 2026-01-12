'use client';

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconEdit,
  IconFilter,
  IconInfoCircle,
  IconPlus,
  IconSend,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

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
  id: string; // Unique ID for this quote entry (for UI tracking)
  itemId: string;
  quoteType: QuoteType;
  quotedVintage?: string;
  costPricePerCaseUsd?: number;
  currency: string;
  caseConfig?: string;
  bottleSize?: string;
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

// Generate unique ID for quote entries
let quoteIdCounter = 0;
const generateQuoteId = () => `quote-${++quoteIdCounter}-${Date.now()}`;

// Common case configurations
const CASE_CONFIGS = [
  { value: '6', label: '6 bottles' },
  { value: '12', label: '12 bottles' },
  { value: '3', label: '3 bottles' },
  { value: '1', label: '1 bottle' },
  { value: '24', label: '24 bottles' },
  { value: 'custom', label: 'Custom...' },
];

// Common bottle sizes (standardised on centilitres)
const BOTTLE_SIZES = [
  { value: '75cl', label: '75cl' },
  { value: '37.5cl', label: '37.5cl' },
  { value: '150cl', label: '150cl (Magnum)' },
  { value: '300cl', label: '300cl (Double Mag)' },
  { value: '600cl', label: '600cl (Imperial)' },
  { value: '50cl', label: '50cl' },
  { value: '18.7cl', label: '18.7cl' },
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

// Lead times
const LEAD_TIMES = [
  { value: 0, label: 'In Stock' },
  { value: 7, label: '1 week' },
  { value: 14, label: '2 weeks' },
  { value: 21, label: '3 weeks' },
  { value: 30, label: '1 month' },
  { value: 60, label: '2 months' },
  { value: 90, label: '3 months' },
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

  // Multi-vintage quotes: Map from itemId to array of quote entries
  const [quotes, setQuotes] = useState<Map<string, QuoteEntry[]>>(new Map());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [partnerNotes, setPartnerNotes] = useState('');
  const [isDeclineDialogOpen, setIsDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showUnquotedOnly, setShowUnquotedOnly] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [entryMode, setEntryMode] = useState<'manual' | 'excel'>('manual');

  // Auto-save key for localStorage
  const storageKey = `source-rfq-draft-v2-${rfqId}`;

  // Track if we've initialized quotes from existing submission
  const [hasInitializedFromSubmission, setHasInitializedFromSubmission] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(storageKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft) as {
          quotes: [string, QuoteEntry[]][];
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

  // Pre-populate quotes from existing submission when partner has already submitted
  useEffect(() => {
    if (!rfq || hasInitializedFromSubmission) return;

    // Only pre-populate if partner has submitted and local quotes state is empty
    if (rfq.partnerStatus === 'submitted' && quotes.size === 0) {
      const existingQuotes = new Map<string, QuoteEntry[]>();

      for (const item of rfq.items) {
        // Get all quotes this partner submitted for this item
        const itemQuotes = item.quotes?.filter((q) => q.isMyQuote) || [];
        if (itemQuotes.length > 0) {
          existingQuotes.set(
            item.id,
            itemQuotes.map((q) => ({
              id: generateQuoteId(),
              itemId: item.id,
              quoteType: q.quoteType as QuoteType,
              quotedVintage: q.quotedVintage || undefined,
              costPricePerCaseUsd: q.costPricePerCaseUsd || undefined,
              currency: q.currency || 'USD',
              caseConfig: q.caseConfig || undefined,
              bottleSize: q.bottleSize || undefined,
              availableQuantity: q.availableQuantity || undefined,
              leadTimeDays: q.leadTimeDays ?? undefined,
              stockLocation: q.stockLocation || undefined,
              stockCondition: q.stockCondition || undefined,
              moq: q.moq || undefined,
              validUntil: q.validUntil ? new Date(q.validUntil) : undefined,
              notes: q.notes || undefined,
              notAvailableReason: q.notAvailableReason || undefined,
              alternativeProductName: q.alternativeProductName || undefined,
              alternativeProducer: q.alternativeProducer || undefined,
              alternativeVintage: q.alternativeVintage || undefined,
              alternativeRegion: q.alternativeRegion || undefined,
              alternativeCountry: q.alternativeCountry || undefined,
              alternativeBottleSize: q.alternativeBottleSize || undefined,
              alternativeCaseConfig: q.alternativeCaseConfig || undefined,
              alternativeLwin: q.alternativeLwin || undefined,
              alternativeReason: q.alternativeReason || undefined,
            })),
          );
        }
      }

      if (existingQuotes.size > 0) {
        setQuotes(existingQuotes);
        setPartnerNotes(rfq.partnerNotes || '');
      }
      setHasInitializedFromSubmission(true);
    }
  }, [rfq, quotes.size, hasInitializedFromSubmission]);

  // Submit quotes mutation
  const { mutate: submitQuotes, isPending: isSubmitting } = useMutation(
    api.source.partner.submitQuotes.mutationOptions({
      onSuccess: (data) => {
        void refetch();
        clearDraft();
        toast.success(
          data.isUpdate
            ? `${data.quoteCount} quote${data.quoteCount !== 1 ? 's' : ''} updated successfully!`
            : `${data.quoteCount} quote${data.quoteCount !== 1 ? 's' : ''} submitted successfully!`,
        );
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to submit quotes');
      },
    }),
  );

  // Decline mutation
  const { mutate: declineRfq, isPending: isDeclining } = useMutation(
    api.source.partner.decline.mutationOptions({
      onSuccess: () => {
        toast.success('RFQ declined');
        router.push('/platform/partner/source');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to decline RFQ');
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
  // Partners can submit or update quotes before deadline
  const canSubmit =
    rfq.partnerStatus !== 'declined' &&
    !isDeadlinePassed;
  // Check if this is an update (already submitted before)
  const isUpdating = rfq.partnerStatus === 'submitted';

  const toggleItemExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  // Add a new vintage quote for an item
  const handleAddVintageQuote = (itemId: string, vintage?: string) => {
    const existingQuotes = quotes.get(itemId) || [];
    const newQuote: QuoteEntry = {
      id: generateQuoteId(),
      itemId,
      quoteType: 'exact',
      quotedVintage: vintage || '',
      currency: 'USD',
    };
    setQuotes(new Map(quotes.set(itemId, [...existingQuotes, newQuote])));

    // Auto-expand when adding a quote
    if (!expandedItems.has(itemId)) {
      setExpandedItems(new Set(expandedItems).add(itemId));
    }
  };

  // Remove a vintage quote
  const handleRemoveVintageQuote = (itemId: string, quoteId: string) => {
    const existingQuotes = quotes.get(itemId) || [];
    const updatedQuotes = existingQuotes.filter((q) => q.id !== quoteId);
    if (updatedQuotes.length === 0) {
      const newQuotes = new Map(quotes);
      newQuotes.delete(itemId);
      setQuotes(newQuotes);
    } else {
      setQuotes(new Map(quotes.set(itemId, updatedQuotes)));
    }
  };

  // Mark item as not available (toggle behavior - click again to clear)
  const handleMarkNotAvailable = (itemId: string) => {
    const existingQuotes = quotes.get(itemId) || [];
    const isCurrentlyNA = existingQuotes.some((q) => q.quoteType === 'not_available');

    if (isCurrentlyNA) {
      // Clear N/A - remove all quotes for this item
      const newQuotes = new Map(quotes);
      newQuotes.delete(itemId);
      setQuotes(newQuotes);
    } else {
      // Set as N/A - replaces all quotes for that item
      const naQuote: QuoteEntry = {
        id: generateQuoteId(),
        itemId,
        quoteType: 'not_available',
        currency: 'USD',
      };
      setQuotes(new Map(quotes.set(itemId, [naQuote])));
    }
  };

  // Update a specific quote entry
  const handleQuoteChange = (
    itemId: string,
    quoteId: string,
    field: keyof QuoteEntry,
    value: string | number | Date | undefined,
  ) => {
    const existingQuotes = quotes.get(itemId) || [];
    const updatedQuotes = existingQuotes.map((q) => {
      if (q.id === quoteId) {
        return { ...q, [field]: value };
      }
      return q;
    });
    setQuotes(new Map(quotes.set(itemId, updatedQuotes)));

    // Auto-expand when user starts filling in data
    if (!expandedItems.has(itemId)) {
      setExpandedItems(new Set(expandedItems).add(itemId));
    }
  };

  const handleSubmitQuotes = () => {
    // Flatten all quotes from all items
    const allQuotes = Array.from(quotes.values()).flat();
    const quotesToSubmit = allQuotes.filter((q) => {
      // N/A quotes are valid without a price
      if (q.quoteType === 'not_available') {
        return true;
      }
      // Exact and alternative quotes need a price
      return q.costPricePerCaseUsd && q.costPricePerCaseUsd > 0;
    });

    if (quotesToSubmit.length === 0) {
      toast.warning('Please enter at least one quote before submitting');
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

  const getQuotesForItem = (itemId: string): QuoteEntry[] => {
    return quotes.get(itemId) || [];
  };

  const getQuoteStatus = (itemId: string): 'empty' | 'complete' | 'partial' | 'na' => {
    const itemQuotes = quotes.get(itemId);
    if (!itemQuotes || itemQuotes.length === 0) return 'empty';
    if (itemQuotes.some((q) => q.quoteType === 'not_available')) return 'na';
    const hasCompleteQuote = itemQuotes.some((q) => q.costPricePerCaseUsd && q.costPricePerCaseUsd > 0);
    if (hasCompleteQuote) return 'complete';
    return 'partial';
  };

  // Count total completed quotes (items with at least one valid quote)
  const completedItemCount = Array.from(quotes.entries()).filter(([, itemQuotes]) => {
    if (itemQuotes.some((q) => q.quoteType === 'not_available')) return true;
    return itemQuotes.some((q) => q.costPricePerCaseUsd && q.costPricePerCaseUsd > 0);
  }).length;

  // Count total vintage quotes submitted
  const totalVintageQuotes = Array.from(quotes.values()).flat().filter((q) => {
    if (q.quoteType === 'not_available') return true;
    return q.costPricePerCaseUsd && q.costPricePerCaseUsd > 0;
  }).length;

  // Filter items
  const filteredItems = showUnquotedOnly
    ? rfq.items.filter((item) => {
        const itemQuotes = quotes.get(item.id);
        if (!itemQuotes || itemQuotes.length === 0) return true;
        if (itemQuotes.some((q) => q.quoteType === 'not_available')) return false;
        return !itemQuotes.some((q) => q.costPricePerCaseUsd && q.costPricePerCaseUsd > 0);
      })
    : rfq.items;

  // Handle parsed quotes from Excel upload
  const handleExcelQuotesParsed = (parsedQuotes: ParsedQuote[]) => {
    const newQuotes = new Map<string, QuoteEntry[]>();

    for (const parsed of parsedQuotes) {
      const quoteEntry: QuoteEntry = {
        id: generateQuoteId(),
        itemId: parsed.itemId,
        quoteType: parsed.quoteType,
        quotedVintage: parsed.quotedVintage,
        costPricePerCaseUsd: parsed.costPricePerCaseUsd,
        currency: 'USD',
        caseConfig: parsed.caseConfig,
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
      // Group quotes by itemId
      const existing = newQuotes.get(parsed.itemId) || [];
      newQuotes.set(parsed.itemId, [...existing, quoteEntry]);
    }

    setQuotes(newQuotes);
    setEntryMode('manual'); // Switch back to manual to review/edit
    // Expand all items so user can review
    setExpandedItems(new Set(parsedQuotes.map((q) => q.itemId)));
  };

  // Copy quote template settings to all unquoted items
  const handleCopySettingsToAll = (sourceItemId: string) => {
    const sourceQuotes = quotes.get(sourceItemId);
    if (!sourceQuotes || sourceQuotes.length === 0) return;
    const sourceQuote = sourceQuotes[0];
    if (!sourceQuote) return;

    const newQuotes = new Map(quotes);
    for (const item of rfq.items) {
      if (item.id !== sourceItemId && (!quotes.has(item.id) || quotes.get(item.id)?.length === 0)) {
        newQuotes.set(item.id, [{
          id: generateQuoteId(),
          itemId: item.id,
          quoteType: 'exact',
          currency: sourceQuote.currency,
          caseConfig: sourceQuote.caseConfig,
          stockLocation: sourceQuote.stockLocation,
          stockCondition: sourceQuote.stockCondition,
          leadTimeDays: sourceQuote.leadTimeDays,
          validUntil: sourceQuote.validUntil,
        }]);
      }
    }
    setQuotes(newQuotes);
  };

  // Parse vintage string to array (e.g., "2019, 2020, 2021" -> ["2019", "2020", "2021"])
  const parseVintages = (vintage: string | null | undefined): string[] => {
    if (!vintage) return [];
    return vintage.split(/[,\/;]/).map((v) => v.trim()).filter(Boolean);
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-4 sm:py-8 pb-28 sm:pb-8">
      <div className="space-y-4 sm:space-y-6">
        {/* Header - Clean and prominent */}
        <div className="space-y-4">
          {/* Back + RFQ number */}
          <div className="flex items-center gap-3">
            <Link href="/platform/partner/source">
              <Button variant="ghost" size="sm" className="p-1.5">
                <ButtonContent iconLeft={IconArrowLeft} />
              </Button>
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-medium text-text-primary bg-fill-muted px-2 py-0.5 rounded">
                {rfq.rfqNumber}
              </span>
              <RfqStatusBadge status={rfq.status} />
            </div>
          </div>

          {/* Title + Deadline + Actions row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <Typography variant="headingLg" className="text-xl sm:text-2xl">
                {rfq.name}
              </Typography>
              {rfq.responseDeadline && (
                <div className={`flex items-center gap-2 text-sm ${
                  isDeadlinePassed
                    ? 'text-red-600'
                    : new Date(rfq.responseDeadline) < new Date(Date.now() + 24 * 60 * 60 * 1000)
                      ? 'text-amber-600'
                      : 'text-text-muted'
                }`}>
                  <IconCalendar className="h-4 w-4" />
                  <span className="font-medium">
                    {isDeadlinePassed
                      ? 'Deadline passed'
                      : `Due ${formatDistanceToNow(new Date(rfq.responseDeadline), { addSuffix: true })}`
                    }
                  </span>
                  <span className="text-text-muted">
                    ({format(new Date(rfq.responseDeadline), 'MMM d, yyyy')})
                  </span>
                </div>
              )}
            </div>

            {/* Desktop action buttons */}
            {canSubmit && (
              <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
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
                  isDisabled={isSubmitting || completedItemCount === 0}
                >
                  <ButtonContent iconLeft={isUpdating ? IconEdit : IconSend}>
                    {isSubmitting
                      ? (isUpdating ? 'Updating...' : 'Submitting...')
                      : `${isUpdating ? 'Update' : 'Submit'} Response`
                    }
                  </ButtonContent>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Progress indicator - Desktop only, mobile uses sticky bar */}
        {canSubmit && (
          <div className="hidden sm:block">
            <Card className="border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    {/* Progress circle */}
                    <div className="relative w-12 h-12">
                      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#e2e8f0"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                          strokeDasharray={`${(completedItemCount / rfq.items.length) * 100}, 100`}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-slate-200">
                        {completedItemCount}
                      </span>
                    </div>
                    <div>
                      <Typography variant="bodyMd" className="font-semibold">
                        {completedItemCount} of {rfq.items.length} items · {totalVintageQuotes} vintage{totalVintageQuotes !== 1 ? 's' : ''}
                      </Typography>
                      {lastSavedAt && (
                        <span className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                          <IconCheck className="h-3 w-3" />
                          Draft saved {formatDistanceToNow(lastSavedAt, { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setShowUnquotedOnly(!showUnquotedOnly)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        showUnquotedOnly
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm'
                      }`}
                    >
                      <IconFilter className="h-4 w-4" />
                      {showUnquotedOnly ? 'Show All' : 'Unquoted Only'}
                    </button>
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-600" />
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-green-500" />
                        Quoted
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-red-500" />
                        N/A
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-slate-300" />
                        Pending
                      </span>
                    </div>
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
                <span className="font-semibold text-text-primary">{completedItemCount}</span>/{rfq.items.length} · {totalVintageQuotes} vintage{totalVintageQuotes !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {Array.from(quotes.values()).flat().filter((q) => q.quoteType !== 'not_available' && q.costPricePerCaseUsd && q.costPricePerCaseUsd > 0).length}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {Array.from(quotes.values()).flat().filter((q) => q.quoteType === 'not_available').length}
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
        {rfq.partnerStatus === 'submitted' && !isDeadlinePassed && (
          <Card className="border-border-success bg-fill-success/5">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <IconCheck className="h-5 w-5 text-text-success flex-shrink-0" />
                <Typography variant="bodyMd" className="text-text-success">
                  You have submitted {rfq.quoteCount} quotes. You can update them before the deadline.
                </Typography>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedItems(new Set(rfq.items.map((i) => i.id)))}
              >
                <ButtonContent iconLeft={IconEdit}>Edit</ButtonContent>
              </Button>
            </CardContent>
          </Card>
        )}

        {rfq.partnerStatus === 'submitted' && isDeadlinePassed && (
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
          <div className="hidden lg:grid lg:grid-cols-[40px_minmax(300px,2fr)_80px_140px_120px_90px] gap-3 px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-t-lg text-xs font-semibold text-text-muted uppercase tracking-wide">
            <span>#</span>
            <span>Product</span>
            <span className="text-center">Qty</span>
            <span className="text-center">Region</span>
            <span className="text-right">Price/case</span>
            <span className="text-center">Status</span>
          </div>

          <div className="divide-y divide-border-muted border border-border-muted rounded-lg lg:rounded-t-none overflow-hidden">
            {filteredItems.map((item, index) => {
              const itemQuotes = getQuotesForItem(item.id);
              const firstQuote = itemQuotes[0];
              const existingQuote = item.myQuote;
              const isExpanded = expandedItems.has(item.id);
              const status = getQuoteStatus(item.id);
              const isNA = firstQuote?.quoteType === 'not_available';
              const requestedVintages = parseVintages(item.vintage);
              const hasMultipleVintages = requestedVintages.length > 1;

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
                    className="px-3 sm:px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => canSubmit && toggleItemExpanded(item.id)}
                  >
                    {/* Desktop: Table row layout */}
                    <div className="hidden lg:grid lg:grid-cols-[40px_minmax(300px,2fr)_80px_140px_120px_90px] gap-3 items-center">
                      {/* Item Number */}
                      <span className="w-8 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>

                      {/* Product Name + Vintage - Full width display */}
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {item.productName}
                        </span>
                        {item.vintage && (
                          <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded ${
                            hasMultipleVintages
                              ? 'text-purple-700 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400'
                              : 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`}>
                            {item.vintage}
                          </span>
                        )}
                        {hasMultipleVintages && (
                          <span className="text-[10px] text-purple-600 font-medium">
                            ({requestedVintages.length} vintages)
                          </span>
                        )}
                        {itemQuotes.length > 1 && (
                          <span className="flex-shrink-0 text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                            {itemQuotes.length} quotes
                          </span>
                        )}
                        {item.adminNotes && (
                          <IconInfoCircle className="h-4 w-4 text-amber-500 flex-shrink-0" title={item.adminNotes} />
                        )}
                      </div>

                      {/* Quantity */}
                      <span className="text-sm text-center font-medium">
                        {item.quantity} {item.quantityUnit === 'bottles' ? 'btl' : 'cs'}
                      </span>

                      {/* Region */}
                      <span className="text-sm text-center text-text-muted" title={item.region || ''}>
                        {item.region || '-'}
                      </span>

                      {/* Price Summary with Config & Lead Time */}
                      <div className="flex flex-col items-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                        {isNA ? (
                          <span className="text-sm font-medium text-red-600">N/A</span>
                        ) : itemQuotes.length > 0 ? (
                          <>
                            <span className="text-sm font-medium text-green-700">
                              {itemQuotes.filter((q) => q.costPricePerCaseUsd).length > 0 && (
                                <>
                                  ${Math.min(...itemQuotes.filter((q) => q.costPricePerCaseUsd).map((q) => q.costPricePerCaseUsd!)).toFixed(0)}
                                  {itemQuotes.length > 1 && '+'}
                                </>
                              )}
                            </span>
                            {/* Show config & lead time from first quote */}
                            {itemQuotes[0] && (itemQuotes[0].caseConfig || itemQuotes[0].leadTimeDays !== undefined) && (
                              <span className="text-[10px] text-text-muted">
                                {itemQuotes[0].caseConfig && `${itemQuotes[0].caseConfig}pk`}
                                {itemQuotes[0].caseConfig && itemQuotes[0].leadTimeDays !== undefined && ' · '}
                                {itemQuotes[0].leadTimeDays !== undefined && (
                                  itemQuotes[0].leadTimeDays === 0 ? 'In Stock' : `${itemQuotes[0].leadTimeDays}d`
                                )}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-text-muted">-</span>
                        )}
                      </div>

                      {/* Status + Actions */}
                      <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {status === 'complete' && (
                          <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                            <IconCheck className="h-3.5 w-3.5 text-white" />
                          </span>
                        )}
                        {status === 'na' && canSubmit && (
                          <button
                            type="button"
                            onClick={() => handleMarkNotAvailable(item.id)}
                            className="px-2 py-1 rounded-md bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors"
                            title="Click to clear N/A and quote this item"
                          >
                            Clear N/A
                          </button>
                        )}
                        {status === 'na' && !canSubmit && (
                          <span className="px-2 py-1 rounded-md bg-red-500 text-white text-xs font-semibold">
                            N/A
                          </span>
                        )}
                        {canSubmit && status !== 'na' && status !== 'complete' && (
                          <button
                            type="button"
                            onClick={() => handleMarkNotAvailable(item.id)}
                            className="px-2 py-1 rounded-md border border-red-300 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
                            title="Mark as Not Available"
                          >
                            N/A
                          </button>
                        )}
                        {canSubmit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleItemExpanded(item.id);
                            }}
                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            {isExpanded ? (
                              <IconChevronUp className="h-4 w-4 text-slate-500" />
                            ) : (
                              <IconChevronDown className="h-4 w-4 text-slate-500" />
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
                            <span className={`text-xs font-semibold px-1 py-0.5 rounded ${
                              hasMultipleVintages
                                ? 'text-purple-700 bg-purple-100'
                                : 'text-text-brand bg-fill-brand/10'
                            }`}>
                              {item.vintage}
                            </span>
                          )}
                          {itemQuotes.length > 1 && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1 py-0.5 rounded">
                              {itemQuotes.length}
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

                      {/* Price Summary - Mobile */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {!isNA && itemQuotes.length > 0 && itemQuotes.some((q) => q.costPricePerCaseUsd) && (
                          <span className="text-xs font-medium text-green-700">
                            ${Math.min(...itemQuotes.filter((q) => q.costPricePerCaseUsd).map((q) => q.costPricePerCaseUsd!)).toFixed(0)}
                          </span>
                        )}
                      </div>

                      {/* Expand Button - Mobile */}
                      {canSubmit && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleItemExpanded(item.id);
                          }}
                          className="flex-shrink-0 p-1 hover:bg-fill-muted rounded"
                        >
                          {isExpanded ? (
                            <IconChevronUp className="h-4 w-4 text-text-muted" />
                          ) : (
                            <IconChevronDown className="h-4 w-4 text-text-muted" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Multi-Vintage Quote Entry Section - Expanded */}
                  {canSubmit && isExpanded && (
                    <div className="border-t border-border-muted bg-fill-secondary/30 px-3 py-3 space-y-3">
                      {/* Header with quick actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-muted">Quotes:</span>
                          {itemQuotes.length === 0 && (
                            <span className="text-xs text-text-muted italic">No quotes yet</span>
                          )}
                          {itemQuotes.length > 0 && !isNA && (
                            <span className="text-xs text-green-600 font-medium">
                              {itemQuotes.length} vintage{itemQuotes.length !== 1 ? 's' : ''} quoted
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!isNA && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAddVintageQuote(item.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                              >
                                <IconPlus className="h-3 w-3" />
                                Add Vintage
                              </button>
                              {hasMultipleVintages && itemQuotes.length === 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    for (const v of requestedVintages) {
                                      handleAddVintageQuote(item.id, v);
                                    }
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-purple-300 text-purple-700 text-xs font-medium hover:bg-purple-50 transition-colors"
                                >
                                  <IconPlus className="h-3 w-3" />
                                  Add All {requestedVintages.length}
                                </button>
                              )}
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleMarkNotAvailable(item.id)}
                            className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                              isNA
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'border border-red-300 text-red-600 hover:bg-red-50'
                            }`}
                            title={isNA ? 'Click to clear N/A and quote this item' : 'Mark as not available'}
                          >
                            {isNA ? 'Clear N/A' : 'N/A'}
                          </button>
                          {status === 'complete' && (
                            <button
                              type="button"
                              onClick={() => handleCopySettingsToAll(item.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded border border-border-muted text-xs text-text-muted hover:bg-fill-muted"
                              title="Copy settings to unquoted items"
                            >
                              <IconCopy className="h-3 w-3" />
                              <span className="hidden sm:inline">Copy to all</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* N/A Reason */}
                      {isNA && firstQuote && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium text-red-700">Reason:</span>
                            {NA_REASONS.slice(0, 4).map((reason) => (
                              <button
                                key={reason.value}
                                type="button"
                                onClick={() => handleQuoteChange(item.id, firstQuote.id, 'notAvailableReason', reason.label)}
                                className={`px-2 py-0.5 rounded text-xs transition-all ${
                                  firstQuote.notAvailableReason === reason.label
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
                              value={NA_REASONS.some((r) => r.label === firstQuote.notAvailableReason) ? '' : firstQuote.notAvailableReason || ''}
                              onChange={(e) => handleQuoteChange(item.id, firstQuote.id, 'notAvailableReason', e.target.value)}
                              className="flex-1 min-w-[100px] px-2 py-0.5 rounded border border-red-200 bg-white text-xs"
                            />
                          </div>
                        </div>
                      )}

                      {/* Individual Vintage Quote Cards */}
                      {!isNA && itemQuotes.map((quote, quoteIndex) => (
                        <div
                          key={quote.id}
                          className="rounded-lg border border-slate-200 bg-white overflow-hidden"
                        >
                          {/* Quote Header */}
                          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500">#{quoteIndex + 1}</span>
                              <div className="flex items-center gap-1.5">
                                <label className="text-xs font-medium text-slate-600">Vintage:</label>
                                <input
                                  type="text"
                                  placeholder="e.g. 2019"
                                  maxLength={4}
                                  value={quote.quotedVintage || ''}
                                  onChange={(e) => handleQuoteChange(item.id, quote.id, 'quotedVintage', e.target.value)}
                                  className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                                />
                              </div>
                              {quote.costPricePerCaseUsd && quote.costPricePerCaseUsd > 0 && (
                                <span className="text-xs font-semibold text-green-600">
                                  ${quote.costPricePerCaseUsd.toFixed(2)}/cs
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveVintageQuote(item.id, quote.id)}
                              className="p-1 rounded hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors"
                              title="Remove this quote"
                            >
                              <IconTrash className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Quote Form */}
                          <div className="p-3 space-y-2">
                            {/* Response Type */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-semibold text-text-muted shrink-0">Type:</span>
                              <div className="flex rounded-md border border-border-muted overflow-hidden">
                                {[
                                  { value: 'exact', label: 'Exact', color: 'bg-green-500 text-white' },
                                  { value: 'alt_vintage', label: 'Alt Vintage', color: 'bg-blue-500 text-white' },
                                  { value: 'alternative', label: 'Alt Product', color: 'bg-amber-500 text-white' },
                                ].map((option, idx) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleQuoteChange(item.id, quote.id, 'quoteType', option.value as QuoteType)}
                                    className={`px-2 py-1 text-[10px] font-medium transition-all ${
                                      idx > 0 ? 'border-l border-border-muted' : ''
                                    } ${
                                      quote.quoteType === option.value
                                        ? option.color
                                        : 'bg-white text-text-muted hover:bg-fill-muted'
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Pricing & Stock Grid */}
                            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                              <div>
                                <label className="block text-[10px] font-medium text-text-muted mb-0.5">Price/cs *</label>
                                <div className="relative">
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={quote.costPricePerCaseUsd || ''}
                                    onChange={(e) => handleQuoteChange(item.id, quote.id, 'costPricePerCaseUsd', parseFloat(e.target.value) || 0)}
                                    className="w-full rounded border border-border-primary bg-white pl-5 pr-1 py-1.5 text-xs text-right font-medium"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-text-muted mb-0.5">Config</label>
                                <select
                                  value={quote.caseConfig || ''}
                                  onChange={(e) => handleQuoteChange(item.id, quote.id, 'caseConfig', e.target.value)}
                                  className="w-full rounded border border-border-primary bg-white px-1 py-1.5 text-xs"
                                >
                                  <option value="">-</option>
                                  {CASE_CONFIGS.slice(0, 4).map((c) => (
                                    <option key={c.value} value={c.value}>{c.value}pk</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-text-muted mb-0.5">Bottle</label>
                                <select
                                  value={quote.bottleSize || ''}
                                  onChange={(e) => handleQuoteChange(item.id, quote.id, 'bottleSize', e.target.value)}
                                  className="w-full rounded border border-border-primary bg-white px-1 py-1.5 text-xs"
                                >
                                  <option value="">-</option>
                                  {BOTTLE_SIZES.map((b) => (
                                    <option key={b.value} value={b.value}>{b.value}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-text-muted mb-0.5">Avail</label>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="qty"
                                  value={quote.availableQuantity || ''}
                                  onChange={(e) => handleQuoteChange(item.id, quote.id, 'availableQuantity', parseInt(e.target.value) || 0)}
                                  className="w-full rounded border border-border-primary bg-white px-1.5 py-1.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-text-muted mb-0.5">Location</label>
                                <select
                                  value={quote.stockLocation || ''}
                                  onChange={(e) => handleQuoteChange(item.id, quote.id, 'stockLocation', e.target.value)}
                                  className="w-full rounded border border-border-primary bg-white px-1 py-1.5 text-xs"
                                >
                                  <option value="">-</option>
                                  {STOCK_LOCATIONS.slice(0, 5).map((l) => (
                                    <option key={l.value} value={l.value}>{l.label.replace(' (Bonded)', '')}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-text-muted mb-0.5">Cond.</label>
                                <select
                                  value={quote.stockCondition || ''}
                                  onChange={(e) => handleQuoteChange(item.id, quote.id, 'stockCondition', e.target.value)}
                                  className="w-full rounded border border-border-primary bg-white px-1 py-1.5 text-xs"
                                >
                                  <option value="">-</option>
                                  {STOCK_CONDITIONS.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-text-muted mb-0.5">Lead</label>
                                <select
                                  value={quote.leadTimeDays ?? ''}
                                  onChange={(e) => handleQuoteChange(item.id, quote.id, 'leadTimeDays', e.target.value === '' ? undefined : parseInt(e.target.value))}
                                  className="w-full rounded border border-border-primary bg-white px-1 py-1.5 text-xs"
                                >
                                  <option value="">-</option>
                                  {LEAD_TIMES.map((lt) => (
                                    <option key={lt.value} value={lt.value}>{lt.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Alt Vintage Info */}
                            {quote.quoteType === 'alt_vintage' && (
                              <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded">
                                <span className="text-xs font-medium text-blue-700">Different vintage than requested</span>
                                <input
                                  type="text"
                                  placeholder="Reason (optional)"
                                  value={quote.alternativeReason || ''}
                                  onChange={(e) => handleQuoteChange(item.id, quote.id, 'alternativeReason', e.target.value)}
                                  className="flex-1 rounded border border-blue-200 bg-white px-2 py-1 text-xs"
                                />
                              </div>
                            )}

                            {/* Alternative Product Fields */}
                            {quote.quoteType === 'alternative' && (
                              <div className="p-2 bg-amber-50 border border-amber-200 rounded space-y-2">
                                <div className="flex items-center gap-2">
                                  <IconAlertTriangle className="h-4 w-4 text-amber-600" />
                                  <span className="text-xs font-semibold text-amber-700">Alternative Product</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  <div className="col-span-2">
                                    <label className="block text-[10px] font-medium text-amber-700 mb-0.5">Wine Name *</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Château Margaux"
                                      value={quote.alternativeProductName || ''}
                                      onChange={(e) => handleQuoteChange(item.id, quote.id, 'alternativeProductName', e.target.value)}
                                      className="w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-amber-700 mb-0.5">Vintage</label>
                                    <input
                                      type="text"
                                      placeholder="2020"
                                      maxLength={4}
                                      value={quote.alternativeVintage || ''}
                                      onChange={(e) => handleQuoteChange(item.id, quote.id, 'alternativeVintage', e.target.value)}
                                      className="w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-xs text-center"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-amber-700 mb-0.5">Producer</label>
                                    <input
                                      type="text"
                                      placeholder="Producer"
                                      value={quote.alternativeProducer || ''}
                                      onChange={(e) => handleQuoteChange(item.id, quote.id, 'alternativeProducer', e.target.value)}
                                      className="w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-xs"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium text-amber-700 mb-0.5">Reason for alternative *</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Requested vintage sold out"
                                    value={quote.alternativeReason || ''}
                                    onChange={(e) => handleQuoteChange(item.id, quote.id, 'alternativeReason', e.target.value)}
                                    className="w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-xs"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Notes */}
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-medium text-text-muted whitespace-nowrap">Notes:</label>
                              <input
                                type="text"
                                placeholder="Item notes (packaging, condition, etc.)"
                                value={quote.notes || ''}
                                onChange={(e) => handleQuoteChange(item.id, quote.id, 'notes', e.target.value)}
                                className="flex-1 rounded border border-border-primary bg-white px-2 py-1 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Empty state - prompt to add quotes */}
                      {!isNA && itemQuotes.length === 0 && (
                        <div className="py-4 text-center">
                          <Typography variant="bodySm" colorRole="muted" className="mb-2">
                            No quotes added for this item yet
                          </Typography>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAddVintageQuote(item.id, requestedVintages[0])}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                              <IconPlus className="h-4 w-4" />
                              Add Quote
                            </button>
                            {hasMultipleVintages && (
                              <button
                                type="button"
                                onClick={() => {
                                  for (const v of requestedVintages) {
                                    handleAddVintageQuote(item.id, v);
                                  }
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-purple-400 text-purple-700 text-sm font-medium hover:bg-purple-50 transition-colors"
                              >
                                <IconPlus className="h-4 w-4" />
                                Quote All {requestedVintages.length} Vintages
                              </button>
                            )}
                          </div>
                        </div>
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
                        {existingQuote.quoteType === 'alt_vintage' && existingQuote.alternativeVintage && (
                          <span className="text-blue-600">Vintage: {existingQuote.alternativeVintage}</span>
                        )}
                        {existingQuote.quoteType === 'alternative' && existingQuote.alternativeProductName && (
                          <span className="text-amber-600">Alt: {existingQuote.alternativeProductName}</span>
                        )}
                        {existingQuote.leadTimeDays !== null && existingQuote.leadTimeDays !== undefined && (
                          <span className="text-text-muted">
                            {existingQuote.leadTimeDays === 0 ? 'In Stock' : `${existingQuote.leadTimeDays}d lead`}
                          </span>
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
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border-primary p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:hidden z-50">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <button
              type="button"
              onClick={() => setIsDeclineDialogOpen(true)}
              className="p-2.5 min-w-[44px] min-h-[44px] rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center"
              aria-label="Decline this RFQ"
            >
              <IconX className="h-5 w-5" />
            </button>
            <Button
              variant="default"
              colorRole="brand"
              onClick={handleSubmitQuotes}
              isDisabled={isSubmitting || completedItemCount === 0}
              className="flex-1 min-h-[44px]"
              aria-label={isSubmitting ? (isUpdating ? 'Updating response' : 'Submitting response') : `${isUpdating ? 'Update' : 'Submit'} response`}
            >
              <ButtonContent iconLeft={isUpdating ? IconEdit : IconSend}>
                {isSubmitting
                  ? (isUpdating ? 'Updating...' : 'Submitting...')
                  : completedItemCount === 0
                    ? 'Quote items to submit'
                    : `${isUpdating ? 'Update' : 'Submit'} Response`
                }
              </ButtonContent>
            </Button>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={completedItemCount} aria-valuemax={rfq.items.length} aria-label="Quote completion progress">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${(completedItemCount / rfq.items.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerRfqDetailPage;
