'use client';

import {
  IconAlertTriangle,
  IconCheck,
  IconCloudUpload,
  IconDownload,
  IconEdit,
  IconFile,
  IconLoader2,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import type { ParsedQuote } from '../utils/parseQuoteExcel';

interface RfqItem {
  id: string;
  productName: string;
  producer: string | null;
  vintage: string | null;
  quantity: number;
  sortOrder: number;
}

export interface QuoteExcelUploadProps {
  rfqId: string;
  items: RfqItem[];
  /** For admin uploading on behalf of partner */
  partnerId?: string;
  /** Called when quotes are parsed and ready to submit */
  onQuotesParsed: (quotes: ParsedQuote[]) => void;
  /** Called to close/cancel the upload flow */
  onCancel?: () => void;
  /** Show download template button */
  showDownloadTemplate?: boolean;
}

/**
 * Component for uploading and parsing Excel quote responses
 *
 * Supports two modes:
 * 1. Partner mode (no partnerId) - uses partner procedure
 * 2. Admin mode (with partnerId) - uses admin procedure
 */
const QuoteExcelUpload = ({
  rfqId,
  items,
  partnerId,
  onQuotesParsed,
  onCancel,
  showDownloadTemplate = true,
}: QuoteExcelUploadProps) => {
  const api = useTRPC();

  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedQuotes, setParsedQuotes] = useState<ParsedQuote[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [editingQuote, setEditingQuote] = useState<string | null>(null);

  // Determine which endpoint to use based on mode
  const isAdminMode = !!partnerId;

  // Download template query (only for partner mode)
  const { refetch: downloadTemplate, isFetching: isDownloading } = useQuery({
    ...api.source.partner.downloadQuoteTemplate.queryOptions({ rfqId }),
    enabled: false,
  });

  // Parse Excel mutation - partner mode
  const { mutate: parsePartner, isPending: isParsingPartner } = useMutation(
    api.source.partner.parseQuoteExcel.mutationOptions({
      onSuccess: (data) => {
        setParsedQuotes(data.quotes);
        setParseError(null);
      },
      onError: (error) => {
        setParseError(error.message);
        setParsedQuotes(null);
      },
    })
  );

  // Parse Excel mutation - admin mode
  const { mutate: parseAdmin, isPending: isParsingAdmin } = useMutation(
    api.source.admin.parseQuoteExcel.mutationOptions({
      onSuccess: (data) => {
        setParsedQuotes(data.quotes);
        setParseError(null);
      },
      onError: (error) => {
        setParseError(error.message);
        setParsedQuotes(null);
      },
    })
  );

  const isParsing = isParsingPartner || isParsingAdmin;

  // Convert ArrayBuffer to base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  };

  // Process uploaded file
  const processFile = useCallback(
    async (file: File) => {
      setUploadedFile(file);
      setParseError(null);
      setParsedQuotes(null);

      try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Validate file size (max 10MB)
        if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
          throw new Error('File size must be less than 10MB');
        }

        // Convert to base64 and send to server for secure parsing
        const base64Content = arrayBufferToBase64(arrayBuffer);

        // Call appropriate parse endpoint with base64-encoded Excel data
        if (isAdminMode && partnerId) {
          parseAdmin({
            rfqId,
            partnerId,
            content: base64Content,
            isBase64Excel: true,
            fileName: file.name,
          });
        } else {
          parsePartner({
            rfqId,
            content: base64Content,
            isBase64Excel: true,
            fileName: file.name,
          });
        }
      } catch (error) {
        setParseError(
          error instanceof Error ? error.message : 'Failed to read file'
        );
      }
    },
    [isAdminMode, partnerId, parseAdmin, parsePartner, rfqId]
  );

  // Handle file drop
  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        await processFile(file);
      }
    },
    [processFile]
  );

  // Handle file input change
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await processFile(file);
      }
    },
    [processFile]
  );

  // Handle template download
  const handleDownloadTemplate = async () => {
    const result = await downloadTemplate();
    if (result.data) {
      // Convert base64 to blob and download
      const byteCharacters = atob(result.data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: result.data.mimeType });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.data.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };

  // Update a parsed quote
  const handleUpdateQuote = (itemId: string, updates: Partial<ParsedQuote>) => {
    if (!parsedQuotes) return;

    setParsedQuotes(
      parsedQuotes.map((q) => (q.itemId === itemId ? { ...q, ...updates } : q))
    );
    setEditingQuote(null);
  };

  // Remove a parsed quote
  const handleRemoveQuote = (itemId: string) => {
    if (!parsedQuotes) return;
    setParsedQuotes(parsedQuotes.filter((q) => q.itemId !== itemId));
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.5) return 'text-amber-600';
    return 'text-red-600';
  };

  // Get confidence label
  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  };

  // Get item by id
  const getItemById = (itemId: string) => items.find((i) => i.id === itemId);

  // Calculate stats
  const stats = parsedQuotes
    ? {
        total: parsedQuotes.length,
        exact: parsedQuotes.filter((q) => q.quoteType === 'exact').length,
        alternative: parsedQuotes.filter((q) => q.quoteType === 'alternative')
          .length,
        notAvailable: parsedQuotes.filter(
          (q) => q.quoteType === 'not_available'
        ).length,
        highConfidence: parsedQuotes.filter((q) => q.confidence >= 0.8).length,
        lowConfidence: parsedQuotes.filter((q) => q.confidence < 0.8).length,
      }
    : null;

  // Clear and reset
  const handleClear = () => {
    setUploadedFile(null);
    setParsedQuotes(null);
    setParseError(null);
  };

  return (
    <div className="space-y-4">
      {/* Download Template Button */}
      {showDownloadTemplate && !isAdminMode && !parsedQuotes && (
        <div className="flex items-center justify-between p-3 bg-fill-brand/5 border border-border-brand rounded-lg">
          <div>
            <Typography variant="bodyMd" className="font-medium">
              Download Quote Template
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Pre-filled with {items.length} RFQ items
            </Typography>
          </div>
          <Button
            variant="outline"
            colorRole="brand"
            size="sm"
            onClick={handleDownloadTemplate}
            isDisabled={isDownloading}
          >
            <ButtonContent iconLeft={isDownloading ? IconLoader2 : IconDownload}>
              {isDownloading ? 'Generating...' : 'Download'}
            </ButtonContent>
          </Button>
        </div>
      )}

      {/* File Upload Zone */}
      {!parsedQuotes && (
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-border-muted hover:border-border-primary'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {isParsing ? (
            <div className="flex flex-col items-center gap-3">
              <IconLoader2 className="h-10 w-10 text-blue-500 animate-spin" />
              <Typography variant="bodyMd" colorRole="muted">
                Parsing quote response...
              </Typography>
              {uploadedFile && (
                <Typography variant="bodyXs" colorRole="muted">
                  {uploadedFile.name}
                </Typography>
              )}
            </div>
          ) : (
            <>
              <IconCloudUpload className="h-10 w-10 text-text-muted mx-auto mb-3" />
              <Typography variant="bodyMd" className="font-medium">
                Drop Excel file here
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mb-3">
                or click to browse (.xlsx, .xls, .csv)
              </Typography>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </>
          )}
        </div>
      )}

      {/* Parse Error */}
      {parseError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <IconAlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <Typography variant="bodyMd" className="font-medium text-red-800">
              Failed to parse file
            </Typography>
            <Typography variant="bodyXs" className="text-red-600">
              {parseError}
            </Typography>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1 hover:bg-red-100 rounded"
          >
            <IconX className="h-4 w-4 text-red-600" />
          </button>
        </div>
      )}

      {/* Parsed Results */}
      {parsedQuotes && stats && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="p-4 bg-fill-success/5 border border-border-success rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <IconCheck className="h-5 w-5 text-text-success" />
              <div className="flex-1">
                <Typography variant="bodyMd" className="font-medium">
                  Parsed {stats.total} quotes from {uploadedFile?.name}
                </Typography>
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="p-1 hover:bg-fill-muted rounded"
                title="Clear and upload different file"
              >
                <IconTrash className="h-4 w-4 text-text-muted" />
              </button>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                {stats.exact} Exact
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                {stats.alternative} Alternative
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                {stats.notAvailable} N/A
              </span>
              <span className="border-l border-border-muted pl-3">
                <span className="text-green-600">{stats.highConfidence}</span> high confidence
              </span>
              {stats.lowConfidence > 0 && (
                <span className="text-amber-600">
                  {stats.lowConfidence} need review
                </span>
              )}
            </div>
          </div>

          {/* Quotes List */}
          <div className="border border-border-muted rounded-lg divide-y divide-border-muted max-h-[400px] overflow-y-auto">
            {parsedQuotes.map((quote) => {
              const item = getItemById(quote.itemId);
              const isEditing = editingQuote === quote.itemId;

              return (
                <div
                  key={quote.itemId}
                  className={`p-3 ${
                    quote.quoteType === 'not_available'
                      ? 'bg-red-50/50'
                      : quote.quoteType === 'alternative'
                        ? 'bg-amber-50/50'
                        : quote.confidence < 0.8
                          ? 'bg-amber-50/30'
                          : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Line Number */}
                    <span className="flex-shrink-0 w-6 h-6 rounded bg-fill-brand/10 text-text-brand text-xs font-bold flex items-center justify-center">
                      {quote.lineNumber}
                    </span>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {item?.productName || quote.productName}
                        </span>
                        {/* Quote Type Badge */}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            quote.quoteType === 'exact'
                              ? 'bg-green-100 text-green-800'
                              : quote.quoteType === 'alternative'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {quote.quoteType === 'exact'
                            ? 'Exact'
                            : quote.quoteType === 'alternative'
                              ? 'Alt'
                              : 'N/A'}
                        </span>
                        {/* Confidence Indicator */}
                        <span
                          className={`text-[10px] font-medium ${getConfidenceColor(quote.confidence)}`}
                        >
                          {getConfidenceLabel(quote.confidence)} ({Math.round(quote.confidence * 100)}%)
                        </span>
                      </div>

                      {/* Quote Details */}
                      {quote.quoteType !== 'not_available' && (
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-text-muted">
                          {quote.costPricePerCaseUsd && (
                            <span className="font-medium text-text-primary">
                              ${quote.costPricePerCaseUsd.toFixed(2)}/case
                            </span>
                          )}
                          {quote.availableQuantity && (
                            <span>{quote.availableQuantity} available</span>
                          )}
                          {quote.leadTimeDays && (
                            <span>{quote.leadTimeDays}d lead</span>
                          )}
                          {quote.stockLocation && (
                            <span>{quote.stockLocation}</span>
                          )}
                        </div>
                      )}

                      {/* Alternative Details */}
                      {quote.quoteType === 'alternative' &&
                        quote.alternativeProductName && (
                          <div className="mt-1 text-xs text-amber-700">
                            Alt: {quote.alternativeProductName}
                            {quote.alternativeVintage &&
                              ` (${quote.alternativeVintage})`}
                            {quote.alternativeReason &&
                              ` - ${quote.alternativeReason}`}
                          </div>
                        )}

                      {/* N/A Reason */}
                      {quote.quoteType === 'not_available' &&
                        quote.notAvailableReason && (
                          <div className="mt-1 text-xs text-red-600">
                            {quote.notAvailableReason}
                          </div>
                        )}

                      {/* Notes */}
                      {quote.notes && (
                        <div className="mt-1 text-xs text-text-muted italic">
                          {quote.notes}
                        </div>
                      )}

                      {/* Editing Form */}
                      {isEditing && (
                        <div className="mt-3 p-3 bg-white border border-border-muted rounded space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-medium text-text-muted mb-0.5">
                                Price/case
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={quote.costPricePerCaseUsd || ''}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value);
                                  if (!isNaN(value)) {
                                    handleUpdateQuote(quote.itemId, {
                                      costPricePerCaseUsd: value,
                                    });
                                  }
                                }}
                                className="w-full rounded border border-border-primary px-2 py-1 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-text-muted mb-0.5">
                                Quote Type
                              </label>
                              <select
                                defaultValue={quote.quoteType}
                                onChange={(e) =>
                                  handleUpdateQuote(quote.itemId, {
                                    quoteType: e.target.value as ParsedQuote['quoteType'],
                                  })
                                }
                                className="w-full rounded border border-border-primary px-2 py-1 text-xs"
                              >
                                <option value="exact">Exact</option>
                                <option value="alternative">Alternative</option>
                                <option value="not_available">Not Available</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingQuote(null)}
                            >
                              <ButtonContent>Done</ButtonContent>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingQuote(isEditing ? null : quote.itemId)
                        }
                        className="p-1.5 hover:bg-fill-muted rounded"
                        title="Edit"
                      >
                        <IconEdit className="h-3.5 w-3.5 text-text-muted" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuote(quote.itemId)}
                        className="p-1.5 hover:bg-red-50 rounded"
                        title="Remove"
                      >
                        <IconTrash className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Low Confidence Warning */}
          {stats.lowConfidence > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <IconAlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <Typography variant="bodyXs" className="text-amber-800">
                {stats.lowConfidence} quote{stats.lowConfidence > 1 ? 's' : ''}{' '}
                have low confidence and may need review before submitting.
              </Typography>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                <ButtonContent iconLeft={IconX}>Cancel</ButtonContent>
              </Button>
            )}
            <Button
              variant="default"
              colorRole="brand"
              onClick={() => onQuotesParsed(parsedQuotes)}
              isDisabled={parsedQuotes.length === 0}
            >
              <ButtonContent iconLeft={IconFile}>
                Use {parsedQuotes.length} Quotes
              </ButtonContent>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuoteExcelUpload;
