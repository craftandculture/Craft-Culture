'use client';

import {
  IconArrowLeft,
  IconDownload,
  IconLoader2,
  IconPlane,
  IconShip,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

const transportModeLabels: Record<string, string> = {
  sea_fcl: 'Sea (FCL)',
  sea_lcl: 'Sea (LCL)',
  air: 'Air',
  road: 'Road',
};

const transportModeIcons: Record<string, typeof IconShip> = {
  sea_fcl: IconShip,
  sea_lcl: IconShip,
  air: IconPlane,
  road: IconTruck,
};

/**
 * Landed Cost Report Page
 *
 * Detailed cost analysis with Excel export
 */
const LandedCostReportPage = () => {
  const api = useTRPC();

  const { data: report, isLoading } = useQuery({
    ...api.logistics.admin.getLandedCostReport.queryOptions({}),
  });

  const { mutate: exportExcel, isPending: isExporting } = useMutation({
    ...api.logistics.admin.exportLandedCostExcel.mutationOptions(),
    onSuccess: (data) => {
      // Create download link
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Excel report downloaded');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to export report');
    },
  });

  const handleExport = () => {
    exportExcel({});
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/platform/admin/logistics/reports">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <div>
              <Typography variant="headingLg" className="mb-2">
                Landed Cost Report
              </Typography>
              <Typography variant="bodyMd" colorRole="muted">
                Cost analysis for delivered shipments
              </Typography>
            </div>
          </div>
          <Button onClick={handleExport} disabled={isExporting}>
            <ButtonContent iconLeft={isExporting ? IconLoader2 : IconDownload}>
              {isExporting ? 'Exporting...' : 'Export Excel'}
            </ButtonContent>
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <Typography variant="bodyXs" colorRole="muted">
                Total Shipments
              </Typography>
              <Typography variant="headingMd">{report?.summary.totalShipments ?? 0}</Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Typography variant="bodyXs" colorRole="muted">
                Total Bottles
              </Typography>
              <Typography variant="headingMd">
                {report?.summary.totalBottles?.toLocaleString() ?? 0}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Typography variant="bodyXs" colorRole="muted">
                Total Landed Cost
              </Typography>
              <Typography variant="headingMd">
                {formatPrice(report?.summary.totalLandedCost ?? 0, 'USD')}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Typography variant="bodyXs" colorRole="muted">
                Avg Cost/Bottle
              </Typography>
              <Typography variant="headingMd" className="text-brand-primary">
                {formatPrice(report?.summary.averageCostPerBottle ?? 0, 'USD')}
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* By Transport Mode */}
        <Card>
          <CardContent className="p-6">
            <Typography variant="headingSm" className="mb-4">
              By Transport Mode
            </Typography>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(report?.byTransportMode ?? {}).map(([mode, data]) => {
                const ModeIcon = transportModeIcons[mode] ?? IconShip;
                return (
                  <div key={mode} className="p-4 rounded-lg bg-surface-secondary">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon icon={ModeIcon} size="sm" colorRole="muted" />
                      <Typography variant="bodySm" className="font-medium">
                        {transportModeLabels[mode] ?? mode}
                      </Typography>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <Typography variant="bodyXs" colorRole="muted">
                          Shipments
                        </Typography>
                        <Typography variant="bodySm">{data.shipmentCount}</Typography>
                      </div>
                      <div className="flex justify-between">
                        <Typography variant="bodyXs" colorRole="muted">
                          Bottles
                        </Typography>
                        <Typography variant="bodySm">
                          {data.totalBottles.toLocaleString()}
                        </Typography>
                      </div>
                      <div className="flex justify-between">
                        <Typography variant="bodyXs" colorRole="muted">
                          Avg/Bottle
                        </Typography>
                        <Typography variant="bodySm" className="font-medium">
                          {formatPrice(data.avgCostPerBottle, 'USD')}
                        </Typography>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Shipments Table */}
        <Card>
          <CardContent className="p-6">
            <Typography variant="headingSm" className="mb-4">
              Shipments
            </Typography>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-muted text-left text-xs uppercase text-text-muted">
                    <th className="pb-3 pr-4">Shipment</th>
                    <th className="pb-3 pr-4">Route</th>
                    <th className="pb-3 pr-4 text-right">Cases</th>
                    <th className="pb-3 pr-4 text-right">Bottles</th>
                    <th className="pb-3 pr-4 text-right">Product</th>
                    <th className="pb-3 pr-4 text-right">Shipping</th>
                    <th className="pb-3 pr-4 text-right">Total</th>
                    <th className="pb-3 text-right">Per Bottle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {report?.shipments.map((shipment) => (
                    <tr key={shipment.shipmentId}>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/platform/admin/logistics/shipments/${shipment.shipmentId}`}
                          className="font-mono text-sm hover:text-brand-primary"
                        >
                          {shipment.shipmentNumber}
                        </Link>
                        <div className="text-xs text-text-muted capitalize">
                          {shipment.transportMode.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-sm">{shipment.route}</td>
                      <td className="py-3 pr-4 text-right">{shipment.cases}</td>
                      <td className="py-3 pr-4 text-right">{shipment.bottles}</td>
                      <td className="py-3 pr-4 text-right">
                        {formatPrice(shipment.costs.product, 'USD')}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {formatPrice(shipment.costs.totalShipping, 'USD')}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium">
                        {formatPrice(shipment.costs.totalLanded, 'USD')}
                      </td>
                      <td className="py-3 text-right font-medium text-brand-primary">
                        {formatPrice(shipment.costs.perBottle, 'USD')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!report?.shipments || report.shipments.length === 0) && (
                <div className="text-center py-8">
                  <Typography variant="bodySm" colorRole="muted">
                    No delivered shipments found
                  </Typography>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        {report?.products && report.products.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <Typography variant="headingSm" className="mb-4">
                Top Products by Cost
              </Typography>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-muted text-left text-xs uppercase text-text-muted">
                      <th className="pb-3 pr-4">Product</th>
                      <th className="pb-3 pr-4 text-right">Bottles</th>
                      <th className="pb-3 pr-4 text-right">Total Cost</th>
                      <th className="pb-3 pr-4 text-right">Avg/Bottle</th>
                      <th className="pb-3 text-right">Shipments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-muted">
                    {report.products.slice(0, 10).map((product, idx) => (
                      <tr key={idx}>
                        <td className="py-3 pr-4">
                          <Typography variant="bodySm" className="font-medium">
                            {product.productName}
                          </Typography>
                          {product.productSku && (
                            <Typography variant="bodyXs" colorRole="muted">
                              {product.productSku}
                            </Typography>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {product.totalBottles.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {formatPrice(product.totalCost, 'USD')}
                        </td>
                        <td className="py-3 pr-4 text-right font-medium">
                          {formatPrice(product.avgCostPerBottle, 'USD')}
                        </td>
                        <td className="py-3 text-right">{product.shipmentCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LandedCostReportPage;
