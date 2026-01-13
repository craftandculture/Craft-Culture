'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconDownload,
  IconPackage,
  IconSend,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

import CustomerPoStatusBadge from '@/app/_source/components/CustomerPoStatusBadge';
import ProfitIndicator from '@/app/_source/components/ProfitIndicator';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Admin Customer PO detail page
 */
const CustomerPoDetailPage = () => {
  const params = useParams<{ poId: string }>();
  const api = useTRPC();
  const queryClient = useQueryClient();

  const { data: customerPo, isLoading } = useQuery({
    ...api.source.admin.customerPo.getOne.queryOptions({ id: params.poId }),
  });

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
    }),
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
    }),
  );

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
  const canGenerateOrders =
    matchedItemCount > 0 &&
    ['draft', 'matched', 'reviewing'].includes(customerPo.status);

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
            </Typography>
          </div>
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                Items
              </Typography>
              <Typography variant="headingMd">
                {customerPo.itemCount}
                {customerPo.losingItemCount > 0 && (
                  <span className="text-text-danger text-sm ml-2">
                    ({customerPo.losingItemCount} losing)
                  </span>
                )}
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* Items Table */}
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b border-border-primary">
              <Typography variant="headingSm">Line Items</Typography>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-fill-secondary border-b border-border-primary">
                  <tr>
                    <th className="text-left p-3 font-medium text-text-muted">Product</th>
                    <th className="text-left p-3 font-medium text-text-muted">Vintage</th>
                    <th className="text-right p-3 font-medium text-text-muted">Qty</th>
                    <th className="text-right p-3 font-medium text-text-muted">Sell/Case</th>
                    <th className="text-right p-3 font-medium text-text-muted">Buy/Case</th>
                    <th className="text-right p-3 font-medium text-text-muted">Profit</th>
                    <th className="text-center p-3 font-medium text-text-muted">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customerPo.items.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b border-border-primary hover:bg-fill-secondary/50 ${
                        item.isLosingItem ? 'bg-fill-danger/5' : ''
                      }`}
                    >
                      <td className="p-3">
                        <Typography variant="bodySm" className="font-medium">
                          {item.productName}
                        </Typography>
                        {item.producer && (
                          <Typography variant="bodySm" colorRole="muted">
                            {item.producer}
                          </Typography>
                        )}
                      </td>
                      <td className="p-3 text-text-muted">{item.vintage || '-'}</td>
                      <td className="p-3 text-right">
                        {item.quantityCases || '-'}
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
                          <span className="text-text-warning">Not matched</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <ProfitIndicator
                          profitUsd={item.profitUsd}
                          profitMarginPercent={item.profitMarginPercent}
                          isLosingItem={item.isLosingItem ?? false}
                          size="sm"
                          showAmount={false}
                        />
                      </td>
                      <td className="p-3 text-center">
                        {item.status === 'matched' && (
                          <IconCheck className="h-4 w-4 text-text-success mx-auto" />
                        )}
                        {item.status === 'pending_match' && (
                          <span className="text-text-warning text-xs">Pending</span>
                        )}
                        {item.status === 'ordered' && (
                          <span className="text-text-brand text-xs">Ordered</span>
                        )}
                        {item.status === 'confirmed' && (
                          <IconCheck className="h-4 w-4 text-text-success mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

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
                          const result = await api.source.admin.customerPo.exportSupplierOrderExcel.query({ id: order.id });
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
      </div>
    </div>
  );
};

export default CustomerPoDetailPage;
