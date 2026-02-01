'use client';

import { IconArrowLeft, IconLoader2 } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * All Stock Records - detailed view of every stock record
 */
const AllStockRecordsPage = () => {
  const api = useTRPC();

  const { data, isLoading } = useQuery({
    ...api.wms.admin.stock.getAll.queryOptions(),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
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
          <div>
            <Link href="/platform/admin/wms/stock">
              <Button variant="ghost" size="sm" className="mb-2">
                <ButtonContent iconLeft={IconArrowLeft}>Back to Stock</ButtonContent>
              </Button>
            </Link>
            <Typography variant="headingLg" className="mb-1">
              All Stock Records
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              {data?.recordCount} records totaling {data?.totalCases} cases
            </Typography>
          </div>
        </div>

        {/* Summary */}
        <Card className="bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Typography variant="headingSm">Total Cases</Typography>
              <Typography variant="headingLg" className="text-blue-600">
                {data?.totalCases}
              </Typography>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border-primary bg-fill-secondary">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Vintage</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Pack</th>
                  <th className="px-4 py-3 text-right font-medium text-text-muted">Cases</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Owner</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Lot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {data?.records.map((record) => (
                  <tr key={record.id} className="hover:bg-fill-secondary">
                    <td className="px-4 py-3">
                      <span className="rounded bg-fill-secondary px-2 py-1 font-mono text-xs">
                        {record.locationCode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <Typography variant="bodySm" className="font-medium">
                          {record.productName}
                        </Typography>
                        {record.producer && (
                          <Typography variant="bodyXs" colorRole="muted">
                            {record.producer}
                          </Typography>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{record.vintage || '-'}</td>
                    <td className="px-4 py-3">
                      {record.caseConfig}x{record.bottleSize}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Typography variant="headingSm" className="text-blue-600">
                        {record.quantityCases}
                      </Typography>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-text-muted">{record.ownerName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-text-muted">
                        {record.lotNumber || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border-primary bg-fill-secondary">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-medium">
                    Total:
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Typography variant="headingMd" className="text-blue-600">
                      {data?.totalCases}
                    </Typography>
                  </td>
                  <td colSpan={2} className="px-4 py-3">
                    <span className="text-text-muted">{data?.recordCount} records</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AllStockRecordsPage;
