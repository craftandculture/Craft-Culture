'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconCloudUpload,
  IconLoader2,
  IconPlus,
  IconSend,
  IconSparkles,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
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
}

interface ExtractedData {
  invoiceNumber?: string;
  invoiceDate?: string;
  currency?: string;
  lineItems: ExtractedLineItem[];
  totalAmount?: number;
}

/**
 * Private Order Creation Form
 *
 * Multi-section form for creating new private client orders.
 * Supports both product catalog search and manual entry.
 */
const PrivateOrderForm = () => {
  const router = useRouter();
  const trpcClient = useTRPCClient();

  // Client info state
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
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Create order mutation
  const createOrder = useMutation({
    mutationFn: async (data: {
      clientName: string;
      clientEmail?: string;
      clientPhone?: string;
      clientAddress?: string;
      deliveryNotes?: string;
      partnerNotes?: string;
    }) => {
      return trpcClient.privateClientOrders.create.mutate(data);
    },
    onSuccess: (order) => {
      toast.success('Order created successfully');
      if (order) {
        router.push(`/platform/private-orders/${order.id}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create order');
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

  // Handle file drop for document extraction
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setIsExtracting(true);
      setExtractionError(null);
      setExtractedData(null);
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

  // Add extracted items to line items
  const handleAddExtractedItems = () => {
    if (!extractedData?.lineItems) return;

    const newItems: LineItem[] = extractedData.lineItems.map((item) => ({
      id: crypto.randomUUID(),
      productName: item.productName,
      producer: item.producer || '',
      vintage: item.vintage || '',
      region: item.region || '',
      lwin: '',
      bottleSize: '750ml',
      caseConfig: 12,
      quantity: item.quantity,
      pricePerCaseUsd: item.unitPrice || 0,
      source: 'manual' as StockSource,
    }));

    setLineItems([...lineItems, ...newItems]);
    setExtractedData(null);
    setUploadedFileName(null);
    toast.success(`Added ${newItems.length} items to order`);
  };

  const handleClearExtraction = () => {
    setExtractedData(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim()) {
      toast.error('Client name is required');
      return;
    }

    // Validate line items
    const validItems = lineItems.filter((item) => item.productName.trim());
    if (validItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }

    // Create the order first
    const order = await createOrder.mutateAsync({
      clientName,
      clientEmail: clientEmail || undefined,
      clientPhone: clientPhone || undefined,
      clientAddress: clientAddress || undefined,
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
        pricePerCaseUsd: item.pricePerCaseUsd,
        source: item.source,
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get product IDs already in the order to exclude from search
  const usedProductIds = lineItems.filter((item) => item.productId).map((item) => item.productId!);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
        <CardContent className="flex flex-col gap-4">
          <Typography variant="headingSm">Client Details</Typography>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Typography variant="bodySm" className="font-medium">
                Client Name *
              </Typography>
              <Input
                placeholder="Enter client name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Typography variant="bodySm" className="font-medium">
                Email
              </Typography>
              <Input
                type="email"
                placeholder="client@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Typography variant="bodySm" className="font-medium">
                Phone
              </Typography>
              <Input
                type="tel"
                placeholder="+971 50 123 4567"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Typography variant="bodySm" className="font-medium">
                Delivery Address
              </Typography>
              <Input
                placeholder="Dubai Marina, Tower 5, Apt 2301"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Typography variant="bodySm" className="font-medium">
              Delivery Notes
            </Typography>
            <Input
              placeholder="Special delivery instructions..."
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Document Upload Section */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Icon icon={IconSparkles} size="sm" colorRole="brand" />
            <Typography variant="headingSm">Import from Invoice</Typography>
            <Badge colorRole="brand" size="sm">
              AI-Powered
            </Badge>
          </div>

          <Typography variant="bodySm" colorRole="muted">
            Upload a partner invoice or price list to automatically extract wine products using AI.
          </Typography>

          {!extractedData && !isExtracting && (
            <div
              {...getRootProps()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors ${
                isDragActive
                  ? 'border-border-brand bg-fill-brand-muted'
                  : 'border-border-muted hover:border-border-brand hover:bg-fill-muted'
              }`}
            >
              <input {...getInputProps()} />
              <Icon icon={IconCloudUpload} size="lg" colorRole={isDragActive ? 'brand' : 'muted'} />
              <div className="text-center">
                <Typography variant="bodySm" className="font-medium">
                  {isDragActive ? 'Drop the file here' : 'Drag & drop a file here'}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  or click to select (PDF, PNG, JPG)
                </Typography>
              </div>
            </div>
          )}

          {isExtracting && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border-muted bg-fill-muted p-6">
              <Icon icon={IconLoader2} size="lg" colorRole="brand" className="animate-spin" />
              <div className="text-center">
                <Typography variant="bodySm" className="font-medium">
                  Extracting products from {uploadedFileName}...
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  This may take a few seconds
                </Typography>
              </div>
            </div>
          )}

          {extractionError && (
            <div className="flex items-center justify-between rounded-lg border border-border-danger bg-fill-danger-muted p-4">
              <div className="flex items-center gap-2">
                <Icon icon={IconX} size="sm" colorRole="danger" />
                <Typography variant="bodySm" colorRole="danger">
                  {extractionError}
                </Typography>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={handleClearExtraction}>
                Try Again
              </Button>
            </div>
          )}

          {extractedData && extractedData.lineItems.length > 0 && (
            <div className="flex flex-col gap-4 rounded-lg border border-border-brand bg-fill-brand-muted p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon={IconCheck} size="sm" colorRole="success" />
                  <Typography variant="bodySm" className="font-medium">
                    Extracted {extractedData.lineItems.length} items from {uploadedFileName}
                  </Typography>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={handleClearExtraction}>
                  <Icon icon={IconX} size="sm" />
                </Button>
              </div>

              {extractedData.invoiceNumber && (
                <Typography variant="bodyXs" colorRole="muted">
                  Invoice: {extractedData.invoiceNumber}
                  {extractedData.invoiceDate && ` • ${extractedData.invoiceDate}`}
                  {extractedData.currency && ` • ${extractedData.currency}`}
                </Typography>
              )}

              <div className="max-h-48 overflow-y-auto">
                <div className="flex flex-col gap-2">
                  {extractedData.lineItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded border border-border-muted bg-fill-primary p-2"
                    >
                      <div className="flex flex-col">
                        <Typography variant="bodySm" className="font-medium">
                          {item.productName}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {[item.producer, item.vintage, item.region].filter(Boolean).join(' • ')}
                        </Typography>
                      </div>
                      <div className="text-right">
                        <Typography variant="bodySm" className="font-medium">
                          {item.quantity} cases
                        </Typography>
                        {item.unitPrice && (
                          <Typography variant="bodyXs" colorRole="muted">
                            {extractedData.currency || '$'}
                            {item.unitPrice.toFixed(2)}/case
                          </Typography>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button type="button" variant="default" colorRole="brand" onClick={handleAddExtractedItems}>
                <ButtonContent iconLeft={IconPlus}>Add {extractedData.lineItems.length} Items to Order</ButtonContent>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Items Section */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Typography variant="headingSm">Products</Typography>
            <Button type="button" variant="outline" size="sm" onClick={handleAddLineItem}>
              <ButtonContent iconLeft={IconPlus}>Add Product</ButtonContent>
            </Button>
          </div>

          {lineItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-muted py-8">
              <Typography variant="bodySm" colorRole="muted">
                No products added yet
              </Typography>
              <Button type="button" variant="default" colorRole="brand" size="sm" onClick={handleAddLineItem}>
                <ButtonContent iconLeft={IconPlus}>Add First Product</ButtonContent>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {lineItems.map((item, index) => (
                <div key={item.id} className="relative">
                  <div className="mb-2 flex items-center justify-between">
                    <Typography variant="labelSm" colorRole="muted">
                      Item {index + 1}
                    </Typography>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveLineItem(item.id)}
                    >
                      <Icon icon={IconTrash} size="sm" colorRole="danger" />
                    </Button>
                  </div>
                  <ProductPicker
                    value={item}
                    onChange={(updates) => handleUpdateLineItem(item.id, updates)}
                    omitProductIds={usedProductIds.filter((id) => id !== item.productId)}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Summary Section */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Typography variant="headingSm">Order Summary</Typography>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Typography variant="bodySm" colorRole="muted">
                Total Cases
              </Typography>
              <Typography variant="bodySm" className="font-medium">
                {calculateTotalCases()}
              </Typography>
            </div>

            <div className="flex items-center justify-between">
              <Typography variant="bodySm" colorRole="muted">
                Total Items
              </Typography>
              <Typography variant="bodySm" className="font-medium">
                {lineItems.length}
              </Typography>
            </div>

            <Divider />

            <div className="flex items-center justify-between">
              <Typography variant="bodySm" colorRole="muted">
                Subtotal (USD)
              </Typography>
              <Typography variant="bodyMd" className="font-semibold">
                {formatCurrency(calculateSubtotal())}
              </Typography>
            </div>

            <Typography variant="bodyXs" colorRole="muted">
              Duty, VAT, and logistics will be calculated after C&C review
            </Typography>
          </div>

          <div className="flex flex-col gap-1.5">
            <Typography variant="bodySm" className="font-medium">
              Internal Notes
            </Typography>
            <Input
              placeholder="Notes for internal use only..."
              value={partnerNotes}
              onChange={(e) => setPartnerNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/platform/private-orders">Cancel</Link>
        </Button>
        <Button
          type="submit"
          variant="default"
          colorRole="brand"
          isDisabled={createOrder.isPending || !clientName.trim()}
        >
          <ButtonContent iconLeft={IconSend}>
            {createOrder.isPending ? 'Creating...' : 'Create Order'}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
};

export default PrivateOrderForm;
