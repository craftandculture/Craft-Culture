'use client';

import {
  IconArrowLeft,
  IconBox,
  IconCheck,
  IconCloudUpload,
  IconInfoCircle,
  IconLoader2,
  IconPlus,
  IconQuestionMark,
  IconSend,
  IconSparkles,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

import ClientsCombobox from '@/app/_privateClientContacts/components/ClientsCombobox';
import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { PrivateClientContact } from '@/database/schema';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

import ProductPicker from './ProductPicker';
import describeAvailableStock from '../utils/describeAvailableStock';
import summarisePcoQuantities from '../utils/summarisePcoQuantities';

type StockSource = 'partner_local' | 'partner_airfreight' | 'cc_inventory' | 'manual';

interface LineItem {
  id: string;
  productId?: string;
  productOfferId?: string;
  productName: string;
  producer: string;
  vintage: string;
  region: string;
  lwin: string;
  bottleSize: string;
  caseConfig: number;
  quantity: number;
  pricePerCaseUsd: number;
  source: StockSource;
}

interface ExtractedLineItem {
  productName: string;
  producer?: string;
  vintage?: string;
  region?: string;
  quantity: number;
  unitPrice?: number;
  total?: number;
  caseConfig?: number;
  bottleSize?: number;
}

interface ExtractedData {
  invoiceNumber?: string;
  invoiceDate?: string;
  currency?: string;
  lineItems: ExtractedLineItem[];
  totalAmount?: number;
}

interface WmsMatchItem {
  lwin18: string;
  productName: string;
  producer: string | null;
  vintage: number | null;
  bottleSize: string;
  caseConfig: number | null;
  availableCases: number;
}

interface MatchResult {
  extractedIndex: number;
  matched: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  wmsItem?: WmsMatchItem;
  extracted: ExtractedLineItem;
}

/**
 * Private Order Creation Form
 *
 * Streamlined form for creating new private client orders.
 * Supports client selection, manual entry, and AI extraction.
 */
const PrivateOrderForm = () => {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const api = useTRPC();

  // Get partner's allowed stock source (CULT wines → cultx, others → local_inventory)
  const { data: stockSourceData } = useQuery(
    api.privateClientOrders.partnerGetStockSource.queryOptions(),
  );
  const stockSource = stockSourceData?.stockSource;

  // Client selection state
  const [selectedClient, setSelectedClient] = useState<PrivateClientContact | null>(null);
  const [isManualClient, setIsManualClient] = useState(false);

  // Client info state (for manual entry)
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [partnerNotes, setPartnerNotes] = useState('');

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Document extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResult[] | null>(null);
  const [matchSummary, setMatchSummary] = useState<{
    total: number;
    matched: number;
    highConfidence: number;
    unmatched: number;
  } | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Store uploaded file data for saving after order creation
  const [uploadedFileData, setUploadedFileData] = useState<{
    base64: string;
    filename: string;
    fileType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/jpg';
  } | null>(null);

  // Submission state
  const [submitAfterCreate, setSubmitAfterCreate] = useState(false);
  // Inline messages show once a save has been tried, not while the form is first filled
  const [showErrors, setShowErrors] = useState(false);

  // Compose full address from client contact fields
  const composeAddress = (client: PrivateClientContact | null) => {
    if (!client) return '';
    const parts = [
      client.addressLine1,
      client.addressLine2,
      client.city,
      client.stateProvince,
      client.postalCode,
      client.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  // Get effective client data
  const effectiveClientName = isManualClient ? clientName : selectedClient?.name ?? '';
  const effectiveClientEmail = isManualClient ? clientEmail : selectedClient?.email ?? '';
  const effectiveClientPhone = isManualClient ? clientPhone : selectedClient?.phone ?? '';
  const effectiveClientAddress = isManualClient ? clientAddress : composeAddress(selectedClient);

  // Handle client selection from dropdown
  const handleClientSelect = (client: PrivateClientContact) => {
    setSelectedClient(client);
    setIsManualClient(false);
    // Pre-fill delivery address from client contact
    setClientAddress(composeAddress(client));
  };

  // Switch to manual client entry
  const handleManualClientEntry = () => {
    setSelectedClient(null);
    setIsManualClient(true);
  };

  // Create order mutation
  const createOrder = useMutation({
    mutationFn: async (data: {
      clientId?: string;
      clientName: string;
      clientEmail?: string;
      clientPhone?: string;
      clientAddress?: string;
      deliveryNotes?: string;
      partnerNotes?: string;
    }) => {
      return trpcClient.privateClientOrders.create.mutate(data);
    },
  });

  // Add line item mutation
  const addLineItem = useMutation({
    mutationFn: async (data: {
      orderId: string;
      productId?: string;
      productOfferId?: string;
      productName: string;
      producer?: string;
      vintage?: string;
      region?: string;
      lwin?: string;
      bottleSize?: string;
      caseConfig?: number;
      quantity: number;
      pricePerCaseUsd: number;
      source: StockSource;
    }) => {
      return trpcClient.privateClientOrders.addItem.mutate(data);
    },
  });

  // Submit order mutation
  const submitOrder = useMutation({
    mutationFn: async (orderId: string) => {
      return trpcClient.privateClientOrders.submit.mutate({ orderId });
    },
  });

  // Upload document mutation
  const uploadDocument = useMutation({
    mutationFn: async (data: {
      orderId: string;
      documentType: 'partner_invoice' | 'cc_invoice' | 'distributor_invoice' | 'payment_proof';
      file: string;
      filename: string;
      fileType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/jpg';
    }) => {
      return trpcClient.privateClientOrders.uploadDocument.mutate(data);
    },
  });

  // Handle file drop for document extraction
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setIsExtracting(true);
      setExtractionError(null);
      setExtractedData(null);
      setMatchResults(null);
      setMatchSummary(null);
      setUploadedFileName(file.name);
      setUploadedFileData(null);

      try {
        // Convert file to base64 data URL
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const base64Data = await base64Promise;

        // Store file data for saving after order creation
        const fileType = file.type as 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/jpg';
        setUploadedFileData({
          base64: base64Data,
          filename: file.name,
          fileType,
        });

        // Call extraction API
        const result = await trpcClient.privateClientOrders.extractDocumentInline.mutate({
          file: base64Data,
          fileType,
        });

        if (result.success && result.data) {
          setExtractedData(result.data);
          toast.success(`Extracted ${result.data.lineItems.length} items from document`);

          // Now match against local stock
          if (result.data.lineItems.length > 0) {
            setIsMatching(true);
            try {
              const matchResult = await trpcClient.privateClientOrders.matchExtractedToLocalStock.mutate({
                extractedItems: result.data.lineItems,
              });

              setMatchResults(matchResult.results);
              setMatchSummary(matchResult.summary);

              if (matchResult.summary.matched > 0) {
                toast.success(
                  `Matched ${matchResult.summary.matched} of ${matchResult.summary.total} items to local stock`,
                );
              } else {
                toast.info('No matches found in local stock');
              }
            } catch (matchError) {
              console.error('Matching failed:', matchError);
              // Don't fail the whole operation, just show extracted data without matches
              toast.info('Items extracted but could not match to local stock');
            } finally {
              setIsMatching(false);
            }
          }
        }
      } catch (error) {
        console.error('Extraction failed:', error);
        setExtractionError(error instanceof Error ? error.message : 'Failed to extract document');
        toast.error('Failed to extract document');
      } finally {
        setIsExtracting(false);
      }
    },
    [trpcClient],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    maxFiles: 1,
    disabled: isExtracting,
  });

  // Add extracted items to line items (using matched product data when available)
  const handleAddExtractedItems = () => {
    if (!extractedData?.lineItems) return;

    const newItems: LineItem[] = extractedData.lineItems.map((item, index) => {
      // Check if we have a WMS match for this item
      const match = matchResults?.find((m) => m.extractedIndex === index && m.matched);

      if (match && match.wmsItem) {
        const bottleSizeFromExtracted = item.bottleSize ? `${item.bottleSize}ml` : '750ml';

        return {
          id: crypto.randomUUID(),
          productName: match.wmsItem.productName,
          producer: match.wmsItem.producer || '',
          vintage: match.wmsItem.vintage?.toString() || '',
          region: '',
          lwin: match.wmsItem.lwin18 || '',
          bottleSize: match.wmsItem.bottleSize || bottleSizeFromExtracted,
          caseConfig: match.wmsItem.caseConfig || item.caseConfig || 12,
          quantity: item.quantity,
          pricePerCaseUsd: item.unitPrice ? Math.round(item.unitPrice * 100) / 100 : 0,
          source: 'cc_inventory' as StockSource,
        };
      }

      // No match - use extracted data as manual entry
      const bottleSizeStr = item.bottleSize ? `${item.bottleSize}ml` : '750ml';

      return {
        id: crypto.randomUUID(),
        productName: item.productName,
        producer: item.producer || '',
        vintage: item.vintage || '',
        region: item.region || '',
        lwin: '',
        bottleSize: bottleSizeStr,
        caseConfig: item.caseConfig || 12,
        quantity: item.quantity,
        pricePerCaseUsd: item.unitPrice ? Math.round(item.unitPrice * 100) / 100 : 0,
        source: 'manual' as StockSource,
      };
    });

    const matchedCount = newItems.filter((i) => i.source === 'cc_inventory').length;
    setLineItems([...lineItems, ...newItems]);
    setExtractedData(null);
    setMatchResults(null);
    setMatchSummary(null);
    setUploadedFileName(null);

    if (matchedCount > 0) {
      toast.success(`Added ${newItems.length} items (${matchedCount} from local stock)`);
    } else {
      toast.success(`Added ${newItems.length} items to order`);
    }
  };

  const handleClearExtraction = () => {
    setExtractedData(null);
    setMatchResults(null);
    setMatchSummary(null);
    setExtractionError(null);
    setUploadedFileName(null);
    setUploadedFileData(null);
  };

  const handleAddLineItem = () => {
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      productName: '',
      producer: '',
      vintage: '',
      region: '',
      lwin: '',
      bottleSize: '750ml',
      caseConfig: 12,
      quantity: 1,
      pricePerCaseUsd: 0,
      source: 'manual',
    };
    setLineItems([...lineItems, newItem]);
  };

  const handleUpdateLineItem = (id: string, updates: Partial<LineItem>) => {
    setLineItems(lineItems.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + item.quantity * item.pricePerCaseUsd, 0);
  };

  const isSubmitting =
    createOrder.isPending || addLineItem.isPending || submitOrder.isPending || uploadDocument.isPending;

  // Cases and single bottles counted apart — "2 bottles", not "2 cases"
  const calculateTotalCases = () => summarisePcoQuantities(lineItems);

  /*
    What is wrong with a line, if anything. A blank line used to be dropped
    silently; it is now named next to the line. A draft may be saved without
    prices, but an order sent to C&C needs a price on every line.
  */
  const lineErrorFor = (item: LineItem) => {
    if (!item.productName.trim()) return 'Choose or enter a wine, or remove this line.';
    if (!Number.isFinite(item.pricePerCaseUsd) || item.pricePerCaseUsd <= 0) {
      return 'Enter your price to C&C for this wine.';
    }
    return null;
  };
  const lineErrors = lineItems.map(lineErrorFor);
  const hasUnnamedLines = lineItems.some((item) => !item.productName.trim());
  const hasLineErrors = lineErrors.some(Boolean);
  const clientMissing = !effectiveClientName.trim();
  const noLines = lineItems.length === 0;

  const handleSubmit = async (e: React.FormEvent, shouldSubmit: boolean = false) => {
    e.preventDefault();

    // Pressing Enter in a field submits the form even while a save is running
    if (isSubmitting) return;

    setShowErrors(true);

    if (clientMissing) {
      toast.error('Select or enter a client');
      return;
    }

    if (noLines) {
      toast.error('Add at least one wine');
      return;
    }

    // A draft may wait for prices; an order sent to C&C may not
    if (shouldSubmit ? hasLineErrors : hasUnnamedLines) {
      toast.error('Some lines need attention before the order can be saved');
      return;
    }

    const validItems = lineItems;

    setSubmitAfterCreate(shouldSubmit);

    // Once the draft exists, a later failure must not lead to a second draft on retry
    let createdOrderId: string | null = null;

    try {
      // Create the order first
      const order = await createOrder.mutateAsync({
        clientId: selectedClient?.id || undefined,
        clientName: effectiveClientName,
        clientEmail: effectiveClientEmail || undefined,
        clientPhone: effectiveClientPhone || undefined,
        clientAddress: effectiveClientAddress || undefined,
        deliveryNotes: deliveryNotes || undefined,
        partnerNotes: partnerNotes || undefined,
      });

      if (!order) {
        toast.error('The order could not be created. Please try again.');
        return;
      }

      createdOrderId = order.id;

      // Then add all line items
      for (const item of validItems) {
        await addLineItem.mutateAsync({
          orderId: order.id,
          productId: item.productId || undefined,
          productOfferId: item.productOfferId || undefined,
          productName: item.productName,
          producer: item.producer || undefined,
          vintage: item.vintage || undefined,
          region: item.region || undefined,
          lwin: item.lwin || undefined,
          bottleSize: item.bottleSize || undefined,
          caseConfig: item.caseConfig || 12,
          quantity: item.quantity,
          pricePerCaseUsd: Math.round(item.pricePerCaseUsd * 100) / 100,
          source: item.source,
        });
      }

      // Upload invoice document if we have one from extraction
      if (uploadedFileData) {
        try {
          await uploadDocument.mutateAsync({
            orderId: order.id,
            documentType: 'partner_invoice',
            file: uploadedFileData.base64,
            filename: uploadedFileData.filename,
            fileType: uploadedFileData.fileType,
          });
        } catch (uploadError) {
          // Log but don't fail order creation if document upload fails
          console.error('Failed to upload invoice document:', uploadError);
          toast.warning('The order was created, but the invoice could not be attached.');
        }
      }

      // Submit if requested
      if (shouldSubmit) {
        await submitOrder.mutateAsync(order.id);
        toast.success('Order submitted to C&C for review');
      } else {
        toast.success('Order saved as a draft');
      }

      router.push(`/platform/private-orders/${order.id}`);
    } catch (error) {
      console.error('Order creation failed:', error);
      if (createdOrderId) {
        // The draft is saved; finish it there rather than creating it again
        toast.error(
          `The order was saved as a draft, but not every step completed${
            error instanceof Error && error.message ? ` (${error.message})` : ''
          }. Please review the draft.`,
        );
        router.push(`/platform/private-orders/${createdOrderId}`);
        return;
      }
      toast.error(error instanceof Error ? error.message : 'The order could not be created');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Get product IDs already in the order to exclude from search
  const usedProductIds = lineItems.filter((item) => item.productId).map((item) => item.productId!);

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/platform/private-orders" aria-label="Back to Private Client Orders">
            <Icon icon={IconArrowLeft} size="sm" />
          </Link>
        </Button>
        <div className="min-w-0">
          <Typography variant="headingLg">New private client order</Typography>
          <Typography variant="bodySm" colorRole="muted">
            Choose the client, add the wines at your price to C&amp;C, then save a draft or submit
            the order to C&amp;C for review.
          </Typography>
        </div>
      </div>

      {/* Client Details Section */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <Typography variant="headingSm">
              1. Client <span className="text-text-muted">*</span>
            </Typography>
            {!isManualClient ? (
              <Button type="button" variant="ghost" size="sm" onClick={handleManualClientEntry}>
                Enter manually
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsManualClient(false)}
              >
                Select existing
              </Button>
            )}
          </div>

          {!isManualClient ? (
            <ClientsCombobox
              value={selectedClient}
              onSelect={handleClientSelect}
              placeholder="Select a client..."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                  Client name *
                </Typography>
                <Input
                  aria-label="Client name"
                  placeholder="Enter client name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  size="sm"
                  required
                />
              </div>
              <div>
                <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                  Email
                </Typography>
                <Input
                  aria-label="Client email"
                  type="email"
                  placeholder="client@example.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  size="sm"
                />
              </div>
              <div>
                <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                  Phone
                </Typography>
                <Input
                  aria-label="Client phone"
                  type="tel"
                  placeholder="+971 50 123 4567"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  size="sm"
                />
              </div>
              <div>
                <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                  Delivery address
                </Typography>
                <Input
                  aria-label="Delivery address"
                  placeholder="Dubai Marina, Tower 5"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  size="sm"
                />
              </div>
            </div>
          )}

          {showErrors && clientMissing && (
            <Typography variant="bodyXs" colorRole="danger">
              {isManualClient ? 'Enter the client name.' : 'Select a client, or enter one manually.'}
            </Typography>
          )}

          {selectedClient && !isManualClient && effectiveClientAddress && (
            <Typography variant="bodyXs" colorRole="muted">
              Delivery address: {effectiveClientAddress}
            </Typography>
          )}

          {(selectedClient || isManualClient) && (
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                Delivery notes (optional)
              </Typography>
              <Input
                aria-label="Delivery notes"
                placeholder="Access, timing or other delivery instructions"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                size="sm"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Upload Section */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <Icon icon={IconSparkles} size="sm" colorRole="brand" />
            <Typography variant="headingSm">Import from an invoice</Typography>
            <Badge colorRole="brand" size="sm">
              Optional
            </Badge>
          </div>
          <Typography variant="bodyXs" colorRole="muted" className="-mt-2">
            Upload your invoice to C&amp;C and the wines are read from it. Check every line before saving.
          </Typography>

          {!extractedData && !isExtracting && (
            <div
              {...getRootProps()}
              className={`flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors ${
                isDragActive
                  ? 'border-text-primary bg-text-primary-muted'
                  : 'border-border-muted hover:border-text-primary hover:bg-fill-muted'
              }`}
            >
              <input {...getInputProps()} />
              <Icon icon={IconCloudUpload} size="md" colorRole={isDragActive ? 'brand' : 'muted'} />
              <div>
                <Typography variant="bodySm">
                  {isDragActive ? 'Drop the file here' : 'Drop an invoice here, or select to upload'}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  PDF, PNG, JPG
                </Typography>
              </div>
            </div>
          )}

          {(isExtracting || isMatching) && (
            <div className="flex items-center justify-center gap-3 rounded-lg border border-border-muted bg-fill-muted p-4">
              <Icon icon={IconLoader2} size="md" colorRole="brand" className="animate-spin" />
              <Typography variant="bodySm">
                {isExtracting ? `Reading ${uploadedFileName}...` : 'Matching to stock...'}
              </Typography>
            </div>
          )}

          {extractionError && (
            <div className="flex items-center justify-between rounded-lg border border-border-danger bg-fill-danger-muted p-3">
              <Typography variant="bodySm" colorRole="danger">
                {extractionError}
              </Typography>
              <Button type="button" variant="ghost" size="sm" onClick={handleClearExtraction}>
                Try again
              </Button>
            </div>
          )}

          {extractedData && extractedData.lineItems.length > 0 && !isMatching && (
            <div className="flex flex-col gap-3 rounded-lg border border-text-primary bg-text-primary-muted p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon={IconCheck} size="sm" colorRole="success" />
                  <Typography variant="bodySm" className="font-medium">
                    {extractedData.lineItems.length} {extractedData.lineItems.length === 1 ? 'wine' : 'wines'} found
                  </Typography>
                  {matchSummary && matchSummary.matched > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                      <IconBox size={12} />
                      {matchSummary.matched} in local stock
                    </span>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={handleClearExtraction} aria-label="Discard imported wines">
                  <Icon icon={IconX} size="sm" />
                </Button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1">
                {extractedData.lineItems.map((item, index) => {
                  const match = matchResults?.find((m) => m.extractedIndex === index);
                  const isMatched = match?.matched;
                  const confidence = match?.confidence || 'none';

                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${
                        isMatched ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-surface-primary/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isMatched ? (
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                              confidence === 'high'
                                ? 'bg-green-500 text-white'
                                : confidence === 'medium'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-slate-400 text-white'
                            }`}
                          >
                            <IconCheck size={12} />
                          </span>
                        ) : (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 dark:bg-slate-500/30 dark:text-slate-300">
                            <IconQuestionMark size={12} />
                          </span>
                        )}
                        <div className="truncate">
                          <span className="font-medium">{item.productName}</span>
                          {isMatched && match?.wmsItem && (
                            <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">
                              → {match.wmsItem.productName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isMatched && match?.wmsItem && (
                          <span className="text-xs text-emerald-700 dark:text-emerald-400">
                            {describeAvailableStock(match.wmsItem.availableCases, match.wmsItem.caseConfig)}
                          </span>
                        )}
                        <span className="tabular-nums text-text-muted">Qty {item.quantity}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button type="button" variant="default" colorRole="brand" size="sm" onClick={handleAddExtractedItems}>
                <ButtonContent iconLeft={IconPlus}>
                  {matchSummary?.matched
                    ? `Add ${matchSummary.matched} matched and ${matchSummary.unmatched} unmatched wines`
                    : 'Add to order'}
                </ButtonContent>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Items Section */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <Typography variant="headingSm">
                2. Wines <span className="text-text-muted">*</span>
              </Typography>
              {lineItems.length > 0 && (
                <Typography variant="bodyXs" colorRole="muted">
                  {lineItems.length} {lineItems.length === 1 ? 'line' : 'lines'} · {calculateTotalCases()}
                </Typography>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleAddLineItem}>
              <ButtonContent iconLeft={IconPlus}>Add wine</ButtonContent>
            </Button>
          </div>

          {/* Cost-not-final-price guardrail — prevents entering the retail price */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-800/60 dark:bg-amber-900/20">
            <Icon icon={IconInfoCircle} size="sm" className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <Typography variant="bodyXs" className="text-amber-900 dark:text-amber-200">
              Enter <strong>your price to C&amp;C</strong> for each wine, as it appears on your invoice
              to C&amp;C. The client price, including import duty and VAT, is{' '}
              <strong>calculated by C&amp;C</strong>. Please do <strong>not</strong> enter the client
              or retail price here.
            </Typography>
          </div>

          {showErrors && noLines && (
            <Typography variant="bodyXs" colorRole="danger">
              Add at least one wine.
            </Typography>
          )}

          {lineItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border-muted bg-surface-secondary/30 py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-text-primary/10">
                <Icon icon={IconPlus} size="lg" className="text-text-primary" />
              </div>
              <div className="text-center">
                <Typography variant="bodySm" className="font-medium">
                  No wines added yet
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                  Pick from your stock or the catalogue, or enter a wine manually
                </Typography>
              </div>
              <Button type="button" variant="default" colorRole="brand" size="sm" onClick={handleAddLineItem}>
                <ButtonContent iconLeft={IconPlus}>Add the first wine</ButtonContent>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {lineItems.map((item, index) => (
                <div key={item.id} className="flex flex-col gap-1">
                  <ProductPicker
                    index={index}
                    value={item}
                    onChange={(updates) => handleUpdateLineItem(item.id, updates)}
                    onRemove={() => handleRemoveLineItem(item.id)}
                    omitProductIds={usedProductIds.filter((id) => id !== item.productId)}
                    source={stockSource}
                    defaultMode={stockSource === 'local_inventory' ? 'wms' : 'search'}
                  />
                  {showErrors && lineErrors[index] && (
                    <Typography variant="bodyXs" colorRole="danger" className="px-1">
                      Line {index + 1}: {lineErrors[index]}
                    </Typography>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Summary Section */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <Typography variant="headingSm">3. Review and submit</Typography>

          <div className="grid grid-cols-3 gap-2 rounded-lg bg-fill-muted/30 p-3 sm:gap-4">
            <div className="text-center">
              <Typography variant="bodyXs" colorRole="muted">
                Lines
              </Typography>
              <Typography variant="headingSm" className="font-bold tabular-nums">
                {lineItems.length}
              </Typography>
            </div>
            <div className="text-center">
              <Typography variant="bodyXs" colorRole="muted">
                Quantity
              </Typography>
              <Typography variant="bodySm" className="font-bold">
                {lineItems.length > 0 ? calculateTotalCases() : '–'}
              </Typography>
            </div>
            <div className="text-center">
              <Typography variant="bodyXs" colorRole="muted">
                Your price to C&amp;C
              </Typography>
              <Typography variant="headingSm" className="font-bold tabular-nums text-text-primary">
                {formatCurrency(calculateSubtotal())}
              </Typography>
            </div>
          </div>
          <Typography variant="bodyXs" colorRole="muted" className="-mt-2">
            The client price is calculated by C&amp;C and shown on the order once it is saved.
          </Typography>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Your notes (optional)
            </Typography>
            <Input
              aria-label="Your notes"
              placeholder="For your own reference, for example the client's request"
              value={partnerNotes}
              onChange={(e) => setPartnerNotes(e.target.value)}
              size="sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions - responsive layout */}
      <div className="flex flex-col gap-1 text-center sm:text-right">
        {clientMissing || noLines ? (
          <Typography variant="bodyXs" colorRole="muted">
            {clientMissing && noLines
              ? 'Choose a client and add at least one wine to continue.'
              : clientMissing
                ? 'Choose a client to continue.'
                : 'Add at least one wine to continue.'}
          </Typography>
        ) : (
          <Typography variant="bodyXs" colorRole="muted">
            Save draft keeps the order with you to finish later. Submit for review sends it to C&amp;C,
            who will confirm pricing and availability.
          </Typography>
        )}
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/platform/private-orders">Cancel</Link>
        </Button>
        <Button
          type="submit"
          variant="outline"
          className="w-full sm:w-auto"
          isDisabled={isSubmitting || clientMissing || noLines}
          disabled={isSubmitting || clientMissing || noLines}
        >
          {isSubmitting && !submitAfterCreate ? 'Saving...' : 'Save draft'}
        </Button>
        <Button
          type="button"
          variant="default"
          colorRole="brand"
          className="w-full sm:w-auto"
          onClick={(e) => handleSubmit(e, true)}
          isDisabled={isSubmitting || clientMissing || noLines}
          disabled={isSubmitting || clientMissing || noLines}
        >
          <ButtonContent iconLeft={IconSend}>
            {isSubmitting && submitAfterCreate ? 'Submitting...' : 'Submit for review'}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
};

export default PrivateOrderForm;
