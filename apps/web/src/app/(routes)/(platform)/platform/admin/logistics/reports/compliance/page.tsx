'use client';

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconFileX,
  IconLoader2,
  IconPrinter,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type FilterType = 'all' | 'missing' | 'expiring' | 'expired';

const filterLabels: Record<FilterType, string> = {
  all: 'All Shipments',
  missing: 'Missing Documents',
  expiring: 'Expiring Documents',
  expired: 'Expired Documents',
};

const statusColors: Record<string, string> = {
  compliant: 'text-green-600 bg-green-100 dark:bg-green-900/30',
  warning: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
  critical: 'text-red-600 bg-red-100 dark:bg-red-900/30',
};

const statusIcons: Record<string, typeof IconCheck> = {
  compliant: IconCheck,
  warning: IconAlertTriangle,
  critical: IconFileX,
};

const documentTypeLabels: Record<string, string> = {
  bill_of_lading: 'Bill of Lading',
  commercial_invoice: 'Commercial Invoice',
  packing_list: 'Packing List',
  certificate_of_origin: 'Certificate of Origin',
  phytosanitary_certificate: 'Phytosanitary Certificate',
  health_certificate: 'Health Certificate',
  import_permit: 'Import Permit',
  export_permit: 'Export Permit',
  customs_declaration: 'Customs Declaration',
  delivery_order: 'Delivery Order',
  insurance_certificate: 'Insurance Certificate',
  airway_bill: 'Airway Bill',
  other: 'Other',
};

/**
 * Document Compliance Report Page
 *
 * Detailed compliance status with print/PDF functionality
 */
const ComplianceReportPage = () => {
  const api = useTRPC();
  const [filter, setFilter] = useState<FilterType>('all');

  const { data: report, isLoading } = useQuery({
    ...api.logistics.admin.getDocumentCompliance.queryOptions({ filter }),
  });

  const handlePrint = () => {
    window.print();
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
        {/* Header - hide on print */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/platform/admin/logistics/reports">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <div>
              <Typography variant="headingLg" className="mb-2">
                Document Compliance Report
              </Typography>
              <Typography variant="bodyMd" colorRole="muted">
                Track missing and expiring documents
              </Typography>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(filterLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handlePrint} variant="outline">
              <ButtonContent iconLeft={IconPrinter}>Print / PDF</ButtonContent>
            </Button>
          </div>
        </div>

        {/* Print Header - only show on print */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold">Document Compliance Report</h1>
          <p className="text-gray-500">Generated: {new Date().toLocaleDateString()}</p>
          <p className="text-gray-500">Filter: {filterLabels[filter]}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 print:grid-cols-4">
          <Card className="print:border print:border-gray-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 print:bg-green-100">
                  <Icon icon={IconCheck} size="sm" className="text-green-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Compliant
                  </Typography>
                  <Typography variant="headingMd" className="text-green-600">
                    {report?.summary.compliantCount ?? 0}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="print:border print:border-gray-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 print:bg-yellow-100">
                  <Icon icon={IconAlertTriangle} size="sm" className="text-yellow-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Warning
                  </Typography>
                  <Typography variant="headingMd" className="text-yellow-600">
                    {report?.summary.warningCount ?? 0}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="print:border print:border-gray-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 print:bg-red-100">
                  <Icon icon={IconFileX} size="sm" className="text-red-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Critical
                  </Typography>
                  <Typography variant="headingMd" className="text-red-600">
                    {report?.summary.criticalCount ?? 0}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="print:border print:border-gray-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30 print:bg-orange-100">
                  <Icon icon={IconClock} size="sm" className="text-orange-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Expiring
                  </Typography>
                  <Typography variant="headingMd" className="text-orange-600">
                    {report?.summary.totalExpiringDocs ?? 0}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Average Score */}
        <Card className="print:border print:border-gray-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <Typography variant="headingSm">Average Compliance Score</Typography>
              <div className="flex items-center gap-4">
                <div className="w-48 h-3 rounded-full bg-surface-secondary overflow-hidden print:bg-gray-200">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${report?.summary.averageComplianceScore ?? 0}%` }}
                  />
                </div>
                <Typography variant="headingMd" className="text-green-600">
                  {report?.summary.averageComplianceScore ?? 100}%
                </Typography>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipments List */}
        <Card className="print:border print:border-gray-300">
          <CardContent className="p-6">
            <Typography variant="headingSm" className="mb-4">
              Shipments ({report?.shipments.length ?? 0})
            </Typography>
            <div className="space-y-4">
              {report?.shipments.map((shipment) => {
                const StatusIcon = statusIcons[shipment.complianceStatus];
                return (
                  <div
                    key={shipment.shipmentId}
                    className="p-4 rounded-lg border border-border-muted print:border-gray-300 print:break-inside-avoid"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/platform/admin/logistics/shipments/${shipment.shipmentId}`}
                            className="font-mono font-medium hover:text-brand-primary print:text-black"
                          >
                            {shipment.shipmentNumber}
                          </Link>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[shipment.complianceStatus]}`}
                          >
                            <StatusIcon className="inline h-3 w-3 mr-1" />
                            {shipment.complianceStatus.toUpperCase()}
                          </span>
                        </div>
                        <Typography variant="bodySm" colorRole="muted">
                          {shipment.route} • {shipment.shipmentType}
                        </Typography>
                      </div>
                      <div className="text-right">
                        <Typography variant="headingSm">{shipment.complianceScore}%</Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {shipment.totalDocuments}/{shipment.requiredDocuments} docs
                        </Typography>
                      </div>
                    </div>

                    {/* Missing Documents */}
                    {shipment.missingDocuments.length > 0 && (
                      <div className="mb-2">
                        <Typography variant="bodyXs" className="font-medium text-red-600 mb-1">
                          Missing Documents:
                        </Typography>
                        <div className="flex flex-wrap gap-1">
                          {shipment.missingDocuments.map((doc) => (
                            <span
                              key={doc}
                              className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 dark:bg-red-900/30 print:bg-red-100"
                            >
                              {documentTypeLabels[doc] ?? doc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expiring Documents */}
                    {shipment.expiringDocuments.length > 0 && (
                      <div className="mb-2">
                        <Typography variant="bodyXs" className="font-medium text-orange-600 mb-1">
                          Expiring Documents:
                        </Typography>
                        <div className="flex flex-wrap gap-1">
                          {shipment.expiringDocuments.map((doc) => (
                            <span
                              key={doc.id}
                              className={`px-2 py-0.5 text-xs rounded ${
                                doc.isUrgent
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 print:bg-red-100'
                                  : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 print:bg-orange-100'
                              }`}
                            >
                              {documentTypeLabels[doc.type] ?? doc.type} - {doc.expiryDate}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expired Documents */}
                    {shipment.expiredDocuments.length > 0 && (
                      <div>
                        <Typography variant="bodyXs" className="font-medium text-red-600 mb-1">
                          Expired Documents:
                        </Typography>
                        <div className="flex flex-wrap gap-1">
                          {shipment.expiredDocuments.map((doc) => (
                            <span
                              key={doc.id}
                              className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 dark:bg-red-900/30 print:bg-red-100"
                            >
                              {documentTypeLabels[doc.type] ?? doc.type} - Expired {doc.expiryDate}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {(!report?.shipments || report.shipments.length === 0) && (
                <div className="text-center py-8">
                  <Typography variant="bodySm" colorRole="muted">
                    No shipments match the selected filter
                  </Typography>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ComplianceReportPage;
