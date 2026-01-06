'use client';

import {
  IconArrowLeft,
  IconBox,
  IconCheck,
  IconCloudUpload,
  IconLoader2,
  IconPlus,
  IconQuestionMark,
  IconSend,
  IconSparkles,
  IconX,
} from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
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
import { useTRPCClient } from '@/lib/trpc/browser';

import ProductPicker from './ProductPicker';

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

interface MatchedProduct {
  id: string;
  name: string;
  producer: string | null;
  year: number | null;
  region: string | null;
  country: string | null;
  lwin18: string;
}

interface MatchedOffer {
  id: string;
  price: number | null;
  currency: string | null;
  unitSize: string | null;
  unitCount: number | null;
  availableQuantity: number;
}

interface MatchResult {
  extractedIndex: number;
  matched: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  product?: MatchedProduct;
  offer?: MatchedOffer;
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

  // Submission state
  const [submitAfterCreate, setSubmitAfterCreate] = useState(false);

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

      try {
        // Convert file to base64 data URL
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const base64Data = await base64Promise;

        // Call extraction API
        const result = await trpcClient.privateClientOrders.extractDocumentInline.mutate({
          file: base64Data,
          fileType: file.type as 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/jpg',
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
      // Check if we have a match for this item
      const match = matchResults?.find((m) => m.extractedIndex === index && m.matched);

      if (match && match.product && match.offer) {
        // Use raw supplier price, converting to USD if needed
        // This avoids double markup from the B2B pricing model
        const exchangeRates: Record<string, number> = {
          USD: 1,
          GBP: 1.27,
          EUR: 1.08,
        };
        const rate = exchangeRates[match.offer.currency ?? 'USD'] ?? 1;
        const rawPriceUsd = match.offer.price
          ? Math.round(match.offer.price * rate * 100) / 100
          : 0;

        // Use matched product data - this links to local stock
        // Fallback to extracted values if offer doesn't have them
        const bottleSizeFromExtracted = item.bottleSize ? `${item.bottleSize}ml` : '750ml';

        return {
          id: crypto.randomUUID(),
          productId: match.product.id,
          productOfferId: match.offer.id,
          productName: match.product.name,
          producer: match.product.producer || '',
          vintage: match.product.year?.toString() || '',
          region: match.product.region || '',
          lwin: match.product.lwin18 || '',
          bottleSize: match.offer.unitSize || bottleSizeFromExtracted,
          caseConfig: match.offer.unitCount || item.caseConfig || 12,
          quantity: item.quantity,
          pricePerCaseUsd: rawPriceUsd,
          source: 'cc_inventory' as StockSource, // Local stock!
        };
      }

      // No match - use extracted data as manual entry
      // Convert bottleSize from ml number to string format (e.g., 750 -> "750ml")
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

    const matchedCount = newItems.filter((i) => i.productId).length;
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

  const calculateTotalCases = () => {
    return lineItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleSubmit = async (e: React.FormEvent, shouldSubmit: boolean = false) => {
    e.preventDefault();

    if (!effectiveClientName.trim()) {
      toast.error('Client name is required');
      return;
    }

    // Validate line items
    const validItems = lineItems.filter((item) => item.productName.trim());
    if (validItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }

    setSubmitAfterCreate(shouldSubmit);

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
        toast.error('Failed to create order');
        return;
      }

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

      // Submit if requested
      if (shouldSubmit) {
        await submitOrder.mutateAsync(order.id);
        toast.success('Order created and submitted for approval');
      } else {
        toast.success('Order saved as draft');
      }

      router.push(`/platform/private-orders/${order.id}`);
    } catch (error) {
      console.error('Order creation failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create order');
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

  const isSubmitting = createOrder.isPending || addLineItem.isPending || submitOrder.isPending;

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/platform/private-orders">
            <Icon icon={IconArrowLeft} size="sm" />
          </Link>
        </Button>
        <Typography variant="headingLg">New Private Order</Typography>
      </div>

      {/* Client Details Section */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <Typography variant="headingSm">Client</Typography>
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
                  Client Name *
                </Typography>
                <Input
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
                  type="tel"
                  placeholder="+971 50 123 4567"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  size="sm"
                />
              </div>
              <div>
                <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                  Address
                </Typography>
                <Input
                  placeholder="Dubai Marina, Tower 5"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  size="sm"
                />
              </div>
            </div>
          )}

          {(selectedClient || isManualClient) && (
            <div>
              <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                Delivery Notes
              </Typography>
              <Input
                placeholder="Special delivery instructions..."
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
            <Typography variant="headingSm">Import from Invoice</Typography>
            <Badge colorRole="brand" size="sm">
              AI
            </Badge>
          </div>

          {!extractedData && !isExtracting && (
            <div
              {...getRootProps()}
              className={`flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors ${
                isDragActive
                  ? 'border-border-brand bg-fill-brand-muted'
                  : 'border-border-muted hover:border-border-brand hover:bg-fill-muted'
              }`}
            >
              <input {...getInputProps()} />
              <Icon icon={IconCloudUpload} size="md" colorRole={isDragActive ? 'brand' : 'muted'} />
              <div>
                <Typography variant="bodySm">
                  {isDragActive ? 'Drop here' : 'Drop invoice or click to upload'}
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
                {isExtracting ? `Extracting from ${uploadedFileName}...` : 'Matching to local stock...'}
              </Typography>
            </div>
          )}

          {extractionError && (
            <div className="flex items-center justify-between rounded-lg border border-border-danger bg-fill-danger-muted p-3">
              <Typography variant="bodySm" colorRole="danger">
                {extractionError}
              </Typography>
              <Button type="button" variant="ghost" size="sm" onClick={handleClearExtraction}>
                Try Again
              </Button>
            </div>
          )}

          {extractedData && extractedData.lineItems.length > 0 && !isMatching && (
            <div className="flex flex-col gap-3 rounded-lg border border-border-brand bg-fill-brand-muted p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon={IconCheck} size="sm" colorRole="success" />
                  <Typography variant="bodySm" className="font-medium">
                    {extractedData.lineItems.length} items extracted
                  </Typography>
                  {matchSummary && matchSummary.matched > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      <IconBox size={12} />
                      {matchSummary.matched} in local stock
                    </span>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={handleClearExtraction}>
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
                        isMatched ? 'bg-green-50' : 'bg-white/50'
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
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                            <IconQuestionMark size={12} />
                          </span>
                        )}
                        <div className="truncate">
                          <span className="font-medium">{item.productName}</span>
                          {isMatched && match?.product && (
                            <span className="ml-2 text-xs text-green-600">
                              → {match.product.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isMatched && match?.offer && (
                          <span className="text-xs text-green-600">
                            ${match.offer.price?.toFixed(0)}/cs
                          </span>
                        )}
                        <span className="text-text-muted">{item.quantity} cs</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button type="button" variant="default" colorRole="brand" size="sm" onClick={handleAddExtractedItems}>
                <ButtonContent iconLeft={IconPlus}>
                  Add {matchSummary?.matched ? `${matchSummary.matched} matched + ${matchSummary.unmatched} manual` : 'to Order'}
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
              <Typography variant="headingSm">Products</Typography>
              {lineItems.length > 0 && (
                <Typography variant="bodyXs" colorRole="muted">
                  {lineItems.length} {lineItems.length === 1 ? 'item' : 'items'} · {calculateTotalCases()} cases
                </Typography>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleAddLineItem}>
              <ButtonContent iconLeft={IconPlus}>Add Product</ButtonContent>
            </Button>
          </div>

          {lineItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border-muted bg-surface-secondary/30 py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-fill-brand/10">
                <Icon icon={IconPlus} size="lg" className="text-text-brand" />
              </div>
              <div className="text-center">
                <Typography variant="bodySm" className="font-medium">
                  Add products from the catalog
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                  Search our wine inventory or enter products manually
                </Typography>
              </div>
              <Button type="button" variant="default" colorRole="brand" size="sm" onClick={handleAddLineItem}>
                <ButtonContent iconLeft={IconPlus}>Add First Product</ButtonContent>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {lineItems.map((item, index) => (
                <ProductPicker
                  key={item.id}
                  index={index}
                  value={item}
                  onChange={(updates) => handleUpdateLineItem(item.id, updates)}
                  onRemove={() => handleRemoveLineItem(item.id)}
                  omitProductIds={usedProductIds.filter((id) => id !== item.productId)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Summary Section */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <Typography variant="headingSm">Order Summary</Typography>

          <div className="grid grid-cols-3 gap-4 rounded-lg bg-fill-muted/30 p-3">
            <div className="text-center">
              <Typography variant="bodyXs" colorRole="muted">
                Items
              </Typography>
              <Typography variant="headingSm" className="font-bold">
                {lineItems.length}
              </Typography>
            </div>
            <div className="text-center">
              <Typography variant="bodyXs" colorRole="muted">
                Cases
              </Typography>
              <Typography variant="headingSm" className="font-bold">
                {calculateTotalCases()}
              </Typography>
            </div>
            <div className="text-center">
              <Typography variant="bodyXs" colorRole="muted">
                Subtotal
              </Typography>
              <Typography variant="headingSm" className="font-bold text-text-brand">
                {formatCurrency(calculateSubtotal())}
              </Typography>
            </div>
          </div>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Internal Notes (optional)
            </Typography>
            <Input
              placeholder="Notes for internal use only..."
              value={partnerNotes}
              onChange={(e) => setPartnerNotes(e.target.value)}
              size="sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions - responsive layout */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/platform/private-orders">Cancel</Link>
        </Button>
        <Button
          type="submit"
          variant="outline"
          className="w-full sm:w-auto"
          isDisabled={isSubmitting || !effectiveClientName.trim() || lineItems.length === 0}
        >
          {isSubmitting && !submitAfterCreate ? 'Saving...' : 'Save Draft'}
        </Button>
        <Button
          type="button"
          variant="default"
          colorRole="brand"
          className="w-full sm:w-auto"
          onClick={(e) => handleSubmit(e, true)}
          isDisabled={isSubmitting || !effectiveClientName.trim() || lineItems.length === 0}
        >
          <ButtonContent iconLeft={IconSend}>
            {isSubmitting && submitAfterCreate ? 'Submitting...' : 'Submit for Approval'}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
};

export default PrivateOrderForm;
