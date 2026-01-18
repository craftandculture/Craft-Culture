'use client';

import {
  IconArrowLeft,
  IconClipboard,
  IconDownload,
  IconFileText,
  IconLoader2,
  IconUpload,
} from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import ExcelJS from 'exceljs';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

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

type DocumentType =
  | 'freight_invoice'
  | 'packing_list'
  | 'bill_of_lading'
  | 'airway_bill'
  | 'commercial_invoice'
  | 'customs_document'
  | 'general';

const documentTypeLabels: Record<DocumentType, string> = {
  freight_invoice: 'Freight Invoice',
  packing_list: 'Packing List',
  bill_of_lading: 'Bill of Lading',
  airway_bill: 'Airway Bill',
  commercial_invoice: 'Commercial Invoice',
  customs_document: 'Customs Document',
  general: 'General / Auto-detect',
};

interface ExtractedData {
  documentType?: string;
  documentNumber?: string;
  documentDate?: string;
  vendor?: string;
  vendorAddress?: string;
  totalAmount?: number;
  currency?: string;
  paymentTerms?: string;
  dueDate?: string;
  bolNumber?: string;
  awbNumber?: string;
  vesselName?: string;
  voyageNumber?: string;
  flightNumber?: string;
  containerNumber?: string;
  shipper?: string;
  shipperAddress?: string;
  consignee?: string;
  consigneeAddress?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  placeOfDelivery?: string;
  shipmentDate?: string;
  arrivalDate?: string;
  totalWeight?: number;
  totalVolume?: number;
  totalCases?: number;
  totalPallets?: number;
  lineItems?: Array<{
    description?: string;
    productName?: string;
    hsCode?: string;
    quantity?: number;
    cases?: number;
    weight?: number;
    volume?: number;
    unitPrice?: number;
    total?: number;
    countryOfOrigin?: string;
  }>;
  costBreakdown?: Array<{
    category: string;
    description?: string;
    amount: number;
    currency?: string;
  }>;
  notes?: string;
  specialInstructions?: string;
}

/**
 * Helper component for displaying labeled data fields
 */
const DataField = ({ label, value }: { label: string; value?: string }) => (
  <div>
    <Typography variant="bodyXs" colorRole="muted">
      {label}
    </Typography>
    <Typography variant="bodySm" className="font-medium">
      {value || '-'}
    </Typography>
  </div>
);

/**
 * PDF Document Extraction Tool
 *
 * Upload logistics documents and extract structured data using AI
 */
const PdfExtractPage = () => {
  const api = useTRPC();
  const [documentType, setDocumentType] = useState<DocumentType>('general');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);

  const { mutate: extractDocument, isPending: isExtracting } = useMutation({
    ...api.logistics.admin.extractDocument.mutationOptions(),
    onSuccess: (result) => {
      setExtractedData(result.data);
      toast.success('Document extracted successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to extract document');
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      setExtractedData(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleExtract = async () => {
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      extractDocument({
        file: base64,
        fileType: selectedFile.type as 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/jpg',
        documentType,
      });
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleCopyJson = () => {
    if (!extractedData) return;
    void navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2));
    toast.success('JSON copied to clipboard');
  };

  const handleExportExcel = async () => {
    if (!extractedData) return;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Craft & Culture';
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Field', key: 'field', width: 25 },
      { header: 'Value', key: 'value', width: 50 },
    ];

    const summaryRows = [
      { field: 'Document Type', value: extractedData.documentType || '-' },
      { field: 'Document Number', value: extractedData.documentNumber || '-' },
      { field: 'Document Date', value: extractedData.documentDate || '-' },
      { field: 'Vendor', value: extractedData.vendor || '-' },
      { field: 'Total Amount', value: extractedData.totalAmount ? `${extractedData.currency || ''} ${extractedData.totalAmount}` : '-' },
      { field: 'BOL Number', value: extractedData.bolNumber || '-' },
      { field: 'AWB Number', value: extractedData.awbNumber || '-' },
      { field: 'Vessel/Flight', value: extractedData.vesselName || extractedData.flightNumber || '-' },
      { field: 'Container Number', value: extractedData.containerNumber || '-' },
      { field: 'Shipper', value: extractedData.shipper || '-' },
      { field: 'Consignee', value: extractedData.consignee || '-' },
      { field: 'Port of Loading', value: extractedData.portOfLoading || '-' },
      { field: 'Port of Discharge', value: extractedData.portOfDischarge || '-' },
      { field: 'Total Weight (kg)', value: extractedData.totalWeight || '-' },
      { field: 'Total Cases', value: extractedData.totalCases || '-' },
    ];

    summarySheet.addRows(summaryRows);
    summarySheet.getRow(1).font = { bold: true };

    // Line items sheet
    if (extractedData.lineItems && extractedData.lineItems.length > 0) {
      const itemsSheet = workbook.addWorksheet('Line Items');
      itemsSheet.columns = [
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Product Name', key: 'productName', width: 30 },
        { header: 'HS Code', key: 'hsCode', width: 15 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: 'Cases', key: 'cases', width: 10 },
        { header: 'Weight (kg)', key: 'weight', width: 12 },
        { header: 'Unit Price', key: 'unitPrice', width: 12 },
        { header: 'Total', key: 'total', width: 12 },
        { header: 'Origin', key: 'countryOfOrigin', width: 15 },
      ];

      for (const item of extractedData.lineItems) {
        itemsSheet.addRow({
          description: item.description || '',
          productName: item.productName || '',
          hsCode: item.hsCode || '',
          quantity: item.quantity || '',
          cases: item.cases || '',
          weight: item.weight || '',
          unitPrice: item.unitPrice || '',
          total: item.total || '',
          countryOfOrigin: item.countryOfOrigin || '',
        });
      }

      itemsSheet.getRow(1).font = { bold: true };
    }

    // Cost breakdown sheet
    if (extractedData.costBreakdown && extractedData.costBreakdown.length > 0) {
      const costsSheet = workbook.addWorksheet('Cost Breakdown');
      costsSheet.columns = [
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Currency', key: 'currency', width: 10 },
      ];

      for (const cost of extractedData.costBreakdown) {
        costsSheet.addRow({
          category: cost.category,
          description: cost.description || '',
          amount: cost.amount,
          currency: cost.currency || extractedData.currency || 'USD',
        });
      }

      costsSheet.getRow(1).font = { bold: true };
    }

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted-${extractedData.documentNumber || 'document'}-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Excel file downloaded');
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/platform/admin/logistics">
              <Icon icon={IconArrowLeft} size="sm" />
            </Link>
          </Button>
          <div>
            <Typography variant="headingLg" className="mb-2">
              Document Extractor
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Upload logistics documents and extract structured data using AI
            </Typography>
          </div>
        </div>

        {/* Upload Section */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Document Type Selector */}
              <div className="flex items-center gap-4">
                <Typography variant="bodySm" className="font-medium w-32">
                  Document Type:
                </Typography>
                <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(documentTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-brand-primary bg-brand-primary/5'
                    : 'border-border-muted hover:border-brand-primary'
                }`}
              >
                <input {...getInputProps()} />
                <Icon
                  icon={selectedFile ? IconFileText : IconUpload}
                  size="xl"
                  colorRole="muted"
                  className="mx-auto mb-4"
                />
                {selectedFile ? (
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      {selectedFile.name}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Click or drag to replace
                    </Typography>
                  </div>
                ) : (
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      {isDragActive ? 'Drop the file here' : 'Drag & drop a document here'}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      or click to select • PDF, PNG, JPG up to 10MB
                    </Typography>
                  </div>
                )}
              </div>

              {/* Extract Button */}
              <div className="flex justify-end">
                <Button onClick={handleExtract} disabled={!selectedFile || isExtracting}>
                  <ButtonContent iconLeft={isExtracting ? IconLoader2 : IconFileText}>
                    {isExtracting ? 'Extracting...' : 'Extract Data'}
                  </ButtonContent>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {extractedData && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Typography variant="headingSm">Extracted Data</Typography>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyJson}>
                    <ButtonContent iconLeft={IconClipboard}>Copy JSON</ButtonContent>
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportExcel}>
                    <ButtonContent iconLeft={IconDownload}>Export Excel</ButtonContent>
                  </Button>
                </div>
              </div>

              <div className="space-y-6">
                {/* Document Info */}
                <div>
                  <Typography variant="bodySm" className="font-medium mb-2 text-text-muted">
                    DOCUMENT INFO
                  </Typography>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <DataField label="Type" value={extractedData.documentType} />
                    <DataField label="Number" value={extractedData.documentNumber} />
                    <DataField label="Date" value={extractedData.documentDate} />
                    <DataField
                      label="Total"
                      value={
                        extractedData.totalAmount
                          ? `${extractedData.currency || ''} ${extractedData.totalAmount.toLocaleString()}`
                          : undefined
                      }
                    />
                  </div>
                </div>

                {/* Vendor/Carrier Info */}
                {(extractedData.vendor || extractedData.bolNumber || extractedData.awbNumber) && (
                  <div>
                    <Typography variant="bodySm" className="font-medium mb-2 text-text-muted">
                      VENDOR / CARRIER
                    </Typography>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <DataField label="Vendor" value={extractedData.vendor} />
                      <DataField label="BOL #" value={extractedData.bolNumber} />
                      <DataField label="AWB #" value={extractedData.awbNumber} />
                      <DataField label="Container" value={extractedData.containerNumber} />
                      <DataField label="Vessel" value={extractedData.vesselName} />
                      <DataField label="Voyage" value={extractedData.voyageNumber} />
                      <DataField label="Flight" value={extractedData.flightNumber} />
                    </div>
                  </div>
                )}

                {/* Route Info */}
                {(extractedData.shipper || extractedData.consignee || extractedData.portOfLoading) && (
                  <div>
                    <Typography variant="bodySm" className="font-medium mb-2 text-text-muted">
                      ROUTE
                    </Typography>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <DataField label="Shipper" value={extractedData.shipper} />
                      <DataField label="Consignee" value={extractedData.consignee} />
                      <DataField label="POL" value={extractedData.portOfLoading} />
                      <DataField label="POD" value={extractedData.portOfDischarge} />
                      <DataField label="Delivery" value={extractedData.placeOfDelivery} />
                    </div>
                  </div>
                )}

                {/* Cargo Summary */}
                {(extractedData.totalWeight || extractedData.totalCases || extractedData.totalPallets) && (
                  <div>
                    <Typography variant="bodySm" className="font-medium mb-2 text-text-muted">
                      CARGO SUMMARY
                    </Typography>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <DataField label="Total Cases" value={extractedData.totalCases?.toString()} />
                      <DataField label="Total Pallets" value={extractedData.totalPallets?.toString()} />
                      <DataField label="Weight (kg)" value={extractedData.totalWeight?.toLocaleString()} />
                      <DataField label="Volume (m³)" value={extractedData.totalVolume?.toLocaleString()} />
                    </div>
                  </div>
                )}

                {/* Line Items */}
                {extractedData.lineItems && extractedData.lineItems.length > 0 && (
                  <div>
                    <Typography variant="bodySm" className="font-medium mb-2 text-text-muted">
                      LINE ITEMS ({extractedData.lineItems.length})
                    </Typography>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border-muted text-left text-xs uppercase text-text-muted">
                            <th className="pb-2 pr-4">Description</th>
                            <th className="pb-2 pr-4">HS Code</th>
                            <th className="pb-2 pr-4 text-right">Qty</th>
                            <th className="pb-2 pr-4 text-right">Cases</th>
                            <th className="pb-2 pr-4 text-right">Weight</th>
                            <th className="pb-2 pr-4 text-right">Unit Price</th>
                            <th className="pb-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-muted">
                          {extractedData.lineItems.map((item, idx) => (
                            <tr key={idx}>
                              <td className="py-2 pr-4">{item.description || item.productName || '-'}</td>
                              <td className="py-2 pr-4 font-mono text-xs">{item.hsCode || '-'}</td>
                              <td className="py-2 pr-4 text-right">{item.quantity || '-'}</td>
                              <td className="py-2 pr-4 text-right">{item.cases || '-'}</td>
                              <td className="py-2 pr-4 text-right">{item.weight || '-'}</td>
                              <td className="py-2 pr-4 text-right">{item.unitPrice || '-'}</td>
                              <td className="py-2 text-right font-medium">{item.total || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Cost Breakdown */}
                {extractedData.costBreakdown && extractedData.costBreakdown.length > 0 && (
                  <div>
                    <Typography variant="bodySm" className="font-medium mb-2 text-text-muted">
                      COST BREAKDOWN
                    </Typography>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border-muted text-left text-xs uppercase text-text-muted">
                            <th className="pb-2 pr-4">Category</th>
                            <th className="pb-2 pr-4">Description</th>
                            <th className="pb-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-muted">
                          {extractedData.costBreakdown.map((cost, idx) => (
                            <tr key={idx}>
                              <td className="py-2 pr-4 capitalize">{cost.category}</td>
                              <td className="py-2 pr-4">{cost.description || '-'}</td>
                              <td className="py-2 text-right font-medium">
                                {cost.currency || extractedData.currency || 'USD'}{' '}
                                {cost.amount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {(extractedData.notes || extractedData.specialInstructions) && (
                  <div>
                    <Typography variant="bodySm" className="font-medium mb-2 text-text-muted">
                      NOTES
                    </Typography>
                    {extractedData.notes && (
                      <Typography variant="bodySm" className="mb-2">
                        {extractedData.notes}
                      </Typography>
                    )}
                    {extractedData.specialInstructions && (
                      <Typography variant="bodySm" colorRole="muted">
                        Special Instructions: {extractedData.specialInstructions}
                      </Typography>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PdfExtractPage;
