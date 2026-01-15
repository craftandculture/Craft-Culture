'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  IconArrowLeft,
  IconCheck,
  IconCloudUpload,
  IconDownload,
  IconFileSpreadsheet,
  IconLoader2,
  IconPackage,
  IconSend,
  IconSparkles,
  IconSwitchHorizontal,
  IconWand,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

import CustomerPoStatusBadge from '@/app/_source/components/CustomerPoStatusBadge';
import ProfitIndicator from '@/app/_source/components/ProfitIndicator';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

/**
 * Admin Customer PO detail page with Excel upload and auto-matching
 */
const CustomerPoDetailPage = () => {
  const params = useParams<{ poId: string }>();
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);

  const { data: customerPo, isLoading } = useQuery({
    ...api.source.admin.customerPo.getOne.queryOptions({ id: params.poId }),
  });

  // Get available suppliers for selection
  const { data: suppliersData } = useQuery({
    ...api.source.admin.customerPo.getAvailableSuppliers.queryOptions({
      customerPoId: params.poId,
      itemIds: selectedItems.size > 0 ? Array.from(selectedItems) : undefined,
    }),
    enabled: isSupplierDialogOpen && selectedItems.size > 0,
  });

  // Parse document mutation
  const { mutate: parseDocument, isPending: isParsing } = useMutation(
    api.source.admin.customerPo.parseDocument.mutationOptions({
      onSuccess: (result) => {
        void queryClient.invalidateQueries({
          queryKey: api.source.admin.customerPo.getOne.queryKey({ id: params.poId }),
        });
        toast.success(
          `Parsed ${result.stats.total} items (${result.stats.withPrice} with prices, ${result.stats.withLwin} with LWIN)`
        );
      },
      onError: (error) => {
        toast.error(`Failed to parse document: ${error.message}`);
      },
    })
  );

  // Auto-match mutation
  const { mutate: autoMatch, isPending: isMatching } = useMutation(
    api.source.admin.customerPo.autoMatch.mutationOptions({
      onSuccess: (result) => {
        void queryClient.invalidateQueries({
          queryKey: api.source.admin.customerPo.getOne.queryKey({ id: params.poId }),
        });
        toast.success(
          `Matched ${result.summary.matchedItems}/${result.summary.totalItems} items. ` +
            `Profit: $${result.summary.totalProfitUsd.toLocaleString()} (${result.summary.profitMarginPercent.toFixed(1)}%)`
        );
        if (result.summary.losingItems > 0) {
          toast.warning(`${result.summary.losingItems} items have negative margin - review required`);
        }
      },
      onError: (error) => {
        toast.error(`Failed to auto-match: ${error.message}`);
      },
    })
  );

  const { mutate: generateOrders, isPending: isGenerating } = useMutation(
    api.source.admin.customerPo.generateSupplierOrders.mutationOptions({
      onSuccess: (result) => {
        void queryClient.invalidateQueries({
          queryKey: api.source.admin.customerPo.getOne.queryKey({ id: params.poId }),
        });
        toast.success(`Generated ${result.ordersCreated} supplier orders`);
      },
      onError: (error) => {
        toast.error(`Failed to generate orders: ${error.message}`);
      },
    })
  );

  const { mutate: sendOrder, isPending: isSending } = useMutation(
    api.source.admin.customerPo.sendSupplierOrder.mutationOptions({
      onSuccess: (result) => {
        void queryClient.invalidateQueries({
          queryKey: api.source.admin.customerPo.getOne.queryKey({ id: params.poId }),
        });
        toast.success(`Order ${result.orderNumber} sent to ${result.partnerName}`);
      },
      onError: (error) => {
        toast.error(`Failed to send order: ${error.message}`);
      },
    })
  );

  const { mutate: bulkChangeSupplier, isPending: isChangingSupplier } = useMutation(
    api.source.admin.customerPo.bulkChangeSupplier.mutationOptions({
      onSuccess: (result) => {
        void queryClient.invalidateQueries({
          queryKey: api.source.admin.customerPo.getOne.queryKey({ id: params.poId }),
        });
        setSelectedItems(new Set());
        setIsSupplierDialogOpen(false);
        toast.success(
          `Changed ${result.matchedCount} items to ${result.partnerName}` +
            (result.unmatchedCount > 0
              ? ` (${result.unmatchedCount} could not be matched)`
              : '')
        );
      },
      onError: (error) => {
        toast.error(`Failed to change supplier: ${error.message}`);
      },
    })
  );

  // Selection handlers
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!customerPo) return;
    if (selectedItems.size === customerPo.items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(customerPo.items.map((i) => i.id)));
    }
  };

  // File upload handling
  const processFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadError(null);

      try {
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('File size must be less than 10MB');
        }

        // Convert to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            // Extract just the base64 part after the data URL prefix
            const base64 = result.split(',')[1];
            if (base64) {
              resolve(base64);
            } else {
              reject(new Error('Failed to extract base64 content'));
            }
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
        });
        reader.readAsDataURL(file);
        const base64Content = await base64Promise;

        // Parse the document
        parseDocument({
          customerPoId: params.poId,
          fileContent: base64Content,
          fileName: file.name,
          autoSave: true,
        });
      } catch (err) {
        console.error('Error uploading file:', err);
        setUploadError(err instanceof Error ? err.message : 'Failed to upload file');
      } finally {
        setIsUploading(false);
      }
    },
    [parseDocument, params.poId]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        void processFile(file);
      }
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: isUploading || isParsing,
  });

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <Typography variant="bodyMd" colorRole="muted">
          Loading Customer PO...
        </Typography>
      </div>
    );
  }

  if (!customerPo) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <Typography variant="bodyMd" colorRole="muted">
          Customer PO not found
        </Typography>
      </div>
    );
  }

  const matchedItemCount = customerPo.items.filter((i) => i.status === 'matched').length;
  const unmatchedItemCount = customerPo.items.filter(
    (i) => i.status === 'pending_match' || i.status === 'unmatched'
  ).length;
  const canAutoMatch =
    customerPo.rfqId &&
    customerPo.items.length > 0 &&
    ['draft', 'parsing', 'matching'].includes(customerPo.status);
  const canGenerateOrders =
    matchedItemCount > 0 && ['draft', 'matched', 'reviewing'].includes(customerPo.status);
  const showUploadSection =
    customerPo.items.length === 0 && ['draft', 'parsing'].includes(customerPo.status);

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <Link
              href="/platform/admin/source/customer-pos"
              className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary mb-4"
            >
              <IconArrowLeft className="h-4 w-4" />
              <Typography variant="bodySm">Back to Customer POs</Typography>
            </Link>
            <div className="flex items-center gap-3 mb-2">
              <Typography variant="headingLg">{customerPo.ccPoNumber}</Typography>
              <CustomerPoStatusBadge status={customerPo.status} />
            </div>
            <Typography variant="bodyMd" colorRole="muted">
              {customerPo.customerCompany || customerPo.customerName}
              {' • Customer PO: '}
              {customerPo.poNumber}
              {customerPo.rfq?.rfqNumber && ` • Linked RFQ: ${customerPo.rfq.rfqNumber}`}
            </Typography>
          </div>
          <div className="flex items-center gap-2">
            {canAutoMatch && (
              <Button
                variant="outline"
                colorRole="brand"
                onClick={() => autoMatch({ customerPoId: customerPo.id })}
                disabled={isMatching}
              >
                <ButtonContent iconLeft={IconWand}>
                  {isMatching ? 'Matching...' : 'Auto Match'}
                </ButtonContent>
              </Button>
            )}
            {canGenerateOrders && (
              <Button
                variant="default"
                colorRole="brand"
                onClick={() => generateOrders({ customerPoId: customerPo.id })}
                disabled={isGenerating}
              >
                <ButtonContent iconLeft={IconPackage}>
                  {isGenerating ? 'Generating...' : 'Generate Supplier Orders'}
                </ButtonContent>
              </Button>
            )}
          </div>
        </div>

        {/* Upload Section - Show when no items */}
        {showUploadSection && (
          <Card className="border-border-brand border-2 border-dashed">
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-fill-brand/10 text-text-brand mb-4">
                  <IconSparkles className="h-4 w-4" />
                  <Typography variant="bodySm" className="font-medium">
                    AI-Powered Parsing
                  </Typography>
                </div>
                <Typography variant="headingSm" className="mb-2">
                  Upload Customer PO Document
                </Typography>
                <Typography variant="bodySm" colorRole="muted">
                  Upload an Excel, CSV, or PDF file and we&apos;ll automatically extract the line items
                </Typography>
              </div>

              {/* Drag & Drop Zone */}
              <div
                {...getRootProps()}
                className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  isDragActive
                    ? 'border-border-brand bg-fill-brand/5'
                    : isUploading || isParsing
                      ? 'cursor-wait border-border-muted bg-fill-muted/50'
                      : 'cursor-pointer border-border-muted hover:border-border-brand hover:bg-fill-muted/50'
                }`}
              >
                <input {...getInputProps()} />

                {isUploading || isParsing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Icon icon={IconLoader2} size="lg" className="animate-spin" colorRole="brand" />
                    <Typography variant="bodySm" colorRole="muted">
                      {isParsing ? 'Parsing document with AI...' : 'Uploading...'}
                    </Typography>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Icon icon={IconCloudUpload} size="lg" colorRole="muted" />
                    <div>
                      <Typography variant="bodySm" className="font-medium">
                        {isDragActive ? 'Drop file here' : 'Drag & drop or click to upload'}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        Excel, CSV, or PDF (max 10MB)
                      </Typography>
                    </div>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="flex items-center gap-2 mt-4 rounded-md bg-fill-danger/10 px-3 py-2">
                  <Icon icon={IconX} size="sm" colorRole="danger" />
                  <Typography variant="bodyXs" colorRole="danger">
                    {uploadError}
                  </Typography>
                </div>
              )}

              {!customerPo.rfqId && (
                <div className="mt-4 p-3 bg-fill-warning/10 border border-border-warning rounded-lg">
                  <Typography variant="bodySm" colorRole="warning">
                    ⚠️ This PO is not linked to an RFQ. Auto-matching will be limited.
                  </Typography>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Re-upload option when items exist */}
        {customerPo.items.length > 0 && ['draft', 'matching', 'matched'].includes(customerPo.status) && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Icon icon={IconFileSpreadsheet} size="md" colorRole="muted" />
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      {customerPo.items.length} items loaded
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Upload a new file to replace existing items
                    </Typography>
                  </div>
                </div>
                <div
                  {...getRootProps()}
                  className="cursor-pointer"
                >
                  <input {...getInputProps()} />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isUploading || isParsing}
                  >
                    <ButtonContent iconLeft={isUploading || isParsing ? IconLoader2 : IconCloudUpload}>
                      {isUploading || isParsing ? 'Processing...' : 'Re-upload'}
                    </ButtonContent>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        {customerPo.items.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodySm" colorRole="muted">
                  Total Sell
                </Typography>
                <Typography variant="headingMd">
                  {formatCurrency(customerPo.totalSellPriceUsd)}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodySm" colorRole="muted">
                  Total Buy
                </Typography>
                <Typography variant="headingMd">
                  {formatCurrency(customerPo.totalBuyPriceUsd)}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodySm" colorRole="muted">
                  Profit
                </Typography>
                <ProfitIndicator
                  profitUsd={customerPo.totalProfitUsd}
                  profitMarginPercent={customerPo.profitMarginPercent}
                  size="md"
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodySm" colorRole="muted">
                  Matched
                </Typography>
                <Typography variant="headingMd">
                  {matchedItemCount}/{customerPo.itemCount}
                  {unmatchedItemCount > 0 && (
                    <span className="text-text-warning text-sm ml-2">
                      ({unmatchedItemCount} unmatched)
                    </span>
                  )}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodySm" colorRole="muted">
                  Issues
                </Typography>
                <Typography variant="headingMd">
                  {(customerPo.losingItemCount ?? 0) > 0 ? (
                    <span className="text-text-danger">
                      {customerPo.losingItemCount} losing
                    </span>
                  ) : (
                    <span className="text-text-success">None</span>
                  )}
                </Typography>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Items Table */}
        {customerPo.items.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b border-border-primary flex items-center justify-between">
                <Typography variant="headingSm">Line Items</Typography>
                <div className="flex items-center gap-2">
                  {selectedItems.size > 0 && customerPo.rfqId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSupplierDialogOpen(true)}
                    >
                      <ButtonContent iconLeft={IconSwitchHorizontal}>
                        Change Supplier ({selectedItems.size})
                      </ButtonContent>
                    </Button>
                  )}
                  {canAutoMatch && unmatchedItemCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => autoMatch({ customerPoId: customerPo.id })}
                      disabled={isMatching}
                    >
                      <ButtonContent iconLeft={IconWand}>
                        {isMatching ? 'Matching...' : `Match ${unmatchedItemCount} items`}
                      </ButtonContent>
                    </Button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-fill-secondary border-b border-border-primary">
                    <tr>
                      <th className="w-10 p-3">
                        <input
                          type="checkbox"
                          checked={selectedItems.size === customerPo.items.length && customerPo.items.length > 0}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-border-primary text-fill-brand focus:ring-fill-brand"
                        />
                      </th>
                      <th className="text-left p-3 font-medium text-text-muted">Product</th>
                      <th className="text-left p-3 font-medium text-text-muted">Vintage</th>
                      <th className="text-right p-3 font-medium text-text-muted">Qty</th>
                      <th className="text-right p-3 font-medium text-text-muted">Sell/Case</th>
                      <th className="text-right p-3 font-medium text-text-muted">Buy/Case</th>
                      <th className="text-right p-3 font-medium text-text-muted">Margin</th>
                      <th className="text-center p-3 font-medium text-text-muted">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerPo.items.map((item) => {
                      // Determine margin color based on profit margin
                      const margin = item.profitMarginPercent;
                      let marginColorClass = 'text-text-muted';
                      if (margin !== null) {
                        if (margin > 5) marginColorClass = 'text-text-success';
                        else if (margin >= 2) marginColorClass = 'text-text-warning';
                        else if (margin >= 0) marginColorClass = 'text-yellow-500';
                        else marginColorClass = 'text-text-danger';
                      }

                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-border-primary hover:bg-fill-secondary/50 ${
                            item.isLosingItem ? 'bg-fill-danger/5' : ''
                          } ${selectedItems.has(item.id) ? 'bg-fill-brand/5' : ''}`}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedItems.has(item.id)}
                              onChange={() => toggleItemSelection(item.id)}
                              className="h-4 w-4 rounded border-border-primary text-fill-brand focus:ring-fill-brand"
                            />
                          </td>
                          <td className="p-3">
                            <Typography variant="bodySm" className="font-medium">
                              {item.productName}
                            </Typography>
                            {item.producer && (
                              <Typography variant="bodySm" colorRole="muted">
                                {item.producer}
                              </Typography>
                            )}
                            {item.lwin && (
                              <Typography variant="bodyXs" colorRole="muted" className="font-mono">
                                LWIN: {item.lwin}
                              </Typography>
                            )}
                          </td>
                          <td className="p-3 text-text-muted">{item.vintage || '-'}</td>
                          <td className="p-3 text-right">
                            {item.quantity || '-'}
                            {item.caseConfig && (
                              <span className="text-text-muted text-xs ml-1">
                                ({item.caseConfig})
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {formatCurrency(item.sellPricePerCaseUsd)}
                          </td>
                          <td className="p-3 text-right">
                            {item.matchedQuote ? (
                              <div>
                                {formatCurrency(item.buyPricePerCaseUsd)}
                                <Typography variant="bodySm" colorRole="muted" className="text-xs">
                                  {item.matchedQuote.partnerName}
                                </Typography>
                              </div>
                            ) : (
                              <span className="text-text-warning">-</span>
                            )}
                          </td>
                          <td className={`p-3 text-right font-medium ${marginColorClass}`}>
                            {margin !== null ? (
                              <>
                                {margin > 0 ? '+' : ''}
                                {margin.toFixed(1)}%
                              </>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {item.status === 'matched' && (
                              <div className="flex items-center justify-center gap-1">
                                <IconCheck className="h-4 w-4 text-text-success" />
                                {item.matchSource && (
                                  <span className="text-xs text-text-muted capitalize">
                                    {item.matchSource}
                                  </span>
                                )}
                              </div>
                            )}
                            {(item.status === 'pending_match' || item.status === 'unmatched') && (
                              <span className="text-text-warning text-xs">Unmatched</span>
                            )}
                            {item.status === 'ordered' && (
                              <span className="text-text-brand text-xs">Ordered</span>
                            )}
                            {item.status === 'confirmed' && (
                              <IconCheck className="h-4 w-4 text-text-success mx-auto" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Supplier Orders */}
        {customerPo.supplierOrders.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b border-border-primary">
                <Typography variant="headingSm">Supplier Orders</Typography>
              </div>
              <div className="divide-y divide-border-primary">
                {customerPo.supplierOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <Typography variant="bodySm" className="font-mono">
                          {order.orderNumber}
                        </Typography>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            order.status === 'sent'
                              ? 'bg-fill-brand/10 text-text-brand'
                              : order.status === 'confirmed'
                                ? 'bg-fill-success/10 text-text-success'
                                : order.status === 'draft'
                                  ? 'bg-fill-primary/10 text-text-muted'
                                  : 'bg-fill-warning/10 text-text-warning'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <Typography variant="bodyMd">{order.partnerName}</Typography>
                      <Typography variant="bodySm" colorRole="muted">
                        {order.itemCount} items • {formatCurrency(order.totalAmountUsd)}
                      </Typography>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.status === 'draft' && (
                        <Button
                          variant="default"
                          colorRole="brand"
                          size="sm"
                          onClick={() =>
                            sendOrder({ supplierOrderId: order.id, sendEmail: true })
                          }
                          disabled={isSending}
                        >
                          <ButtonContent iconLeft={IconSend}>Send</ButtonContent>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        colorRole="primary"
                        size="sm"
                        onClick={async () => {
                          const result =
                            await trpcClient.source.admin.customerPo.exportSupplierOrderExcel.query({
                              id: order.id,
                            });
                          // Download the file
                          const link = document.createElement('a');
                          link.href = `data:${result.mimeType};base64,${result.base64}`;
                          link.download = result.filename;
                          link.click();
                        }}
                      >
                        <ButtonContent iconLeft={IconDownload}>Excel</ButtonContent>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Change Supplier Dialog */}
        <Dialog.Root open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
            <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-fill-primary rounded-lg shadow-lg w-full max-w-md z-50 p-6">
              <Dialog.Title asChild>
                <Typography variant="headingSm" className="mb-2">
                  Change Supplier
                </Typography>
              </Dialog.Title>
              <Dialog.Description asChild>
                <Typography variant="bodySm" colorRole="muted" className="mb-4">
                  Select a supplier for {selectedItems.size} selected item{selectedItems.size !== 1 ? 's' : ''}.
                  Items will be matched to this supplier&apos;s quotes.
                </Typography>
              </Dialog.Description>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {suppliersData?.suppliers && suppliersData.suppliers.length > 0 ? (
                  suppliersData.suppliers.map((supplier) => (
                    <button
                      key={supplier.partnerId}
                      onClick={() =>
                        bulkChangeSupplier({
                          customerPoId: customerPo.id,
                          itemIds: Array.from(selectedItems),
                          partnerId: supplier.partnerId,
                        })
                      }
                      disabled={isChangingSupplier}
                      className="w-full text-left p-3 rounded-lg border border-border-primary hover:border-border-brand hover:bg-fill-secondary/50 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <Typography variant="bodySm" className="font-medium">
                          {supplier.partnerName}
                        </Typography>
                        <span className="text-xs text-text-muted">
                          {supplier.coverage}% coverage
                        </span>
                      </div>
                      <Typography variant="bodyXs" colorRole="muted">
                        Can match {supplier.matchableItems} of {supplier.totalItems} items
                      </Typography>
                    </button>
                  ))
                ) : (
                  <Typography variant="bodySm" colorRole="muted" className="text-center py-4">
                    No alternative suppliers available
                  </Typography>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Dialog.Close asChild>
                  <Button variant="outline" size="sm">
                    Cancel
                  </Button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  );
};

export default CustomerPoDetailPage;
