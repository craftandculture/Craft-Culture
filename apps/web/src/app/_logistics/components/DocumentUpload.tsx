'use client';

import {
  IconCheck,
  IconCloudUpload,
  IconFile,
  IconFileText,
  IconLoader2,
  IconPackageImport,
  IconPhoto,
  IconSparkles,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upload } from '@vercel/blob/client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { LogisticsDocument } from '@/database/schema';
import { useTRPCClient } from '@/lib/trpc/browser';

interface ExtractedLineItem {
  description?: string;
  productName?: string;
  lwin?: string;
  producer?: string;
  vintage?: number;
  bottleSize?: string;
  bottlesPerCase?: number;
  cases?: number;
  hsCode?: string;
  countryOfOrigin?: string;
  unitPrice?: number;
  total?: number;
}

interface ExtractionResult {
  documentType?: string;
  lineItems?: ExtractedLineItem[];
  totalCases?: number;
  totalWeight?: number;
}

type DocumentType =
  | 'bill_of_lading'
  | 'airway_bill'
  | 'commercial_invoice'
  | 'packing_list'
  | 'certificate_of_origin'
  | 'customs_declaration'
  | 'import_permit'
  | 'export_permit'
  | 'delivery_note'
  | 'health_certificate'
  | 'insurance_certificate'
  | 'proof_of_delivery'
  | 'other';

interface DocumentUploadProps {
  shipmentId: string;
  documents?: LogisticsDocument[];
  onUploadComplete?: () => void;
}

const documentTypeLabels: Record<DocumentType, string> = {
  bill_of_lading: 'Bill of Lading',
  airway_bill: 'Airway Bill',
  commercial_invoice: 'Commercial Invoice',
  packing_list: 'Packing List',
  certificate_of_origin: 'Certificate of Origin',
  customs_declaration: 'Customs Declaration',
  import_permit: 'Import Permit',
  export_permit: 'Export Permit',
  delivery_note: 'Delivery Note',
  health_certificate: 'Health Certificate',
  insurance_certificate: 'Insurance Certificate',
  proof_of_delivery: 'Proof of Delivery',
  other: 'Other',
};

/**
 * Document upload component for logistics shipments
 *
 * Supports drag-and-drop upload of shipping documents.
 */
// Document types that support AI extraction
const extractableTypes: DocumentType[] = ['commercial_invoice', 'packing_list'];

const LogisticsDocumentUpload = ({
  shipmentId,
  documents = [],
  onUploadComplete,
}: DocumentUploadProps) => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState<DocumentType>('commercial_invoice');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractingDocId, setExtractingDocId] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Upload mutation — creates DB record after file is uploaded to Blob
  const { mutateAsync: createDocumentRecord } = useMutation({
    mutationFn: async (data: { blobUrl: string; filename: string; fileType: string; fileSize: number }) => {
      return trpcClient.logistics.admin.uploadDocument.mutate({
        shipmentId,
        documentType: selectedType,
        blobUrl: data.blobUrl,
        filename: data.filename,
        fileType: data.fileType as 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/jpg',
        fileSize: data.fileSize,
      });
    },
    onSuccess: () => {
      toast.success('Document uploaded successfully');
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getOne']] });
      onUploadComplete?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to upload document');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return trpcClient.logistics.admin.deleteDocument.mutate({ documentId });
    },
    onSuccess: () => {
      toast.success('Document deleted');
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getOne']] });
      onUploadComplete?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete document');
    },
  });

  // Extract items from document
  const handleExtract = useCallback(
    async (doc: LogisticsDocument) => {
      setIsExtracting(true);
      setExtractingDocId(doc.id);
      setExtractionResult(null);

      try {
        // Fetch the document file and convert to base64
        const response = await fetch(doc.fileUrl);
        const blob = await response.blob();

        const base64Promise = new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(blob);
        });
        const base64 = await base64Promise;

        // Map document type to extraction type
        const extractionType =
          doc.documentType === 'commercial_invoice'
            ? 'commercial_invoice'
            : doc.documentType === 'packing_list'
              ? 'packing_list'
              : 'general';

        // Call extraction API
        const result = await trpcClient.logistics.admin.extractDocument.mutate({
          file: base64,
          fileType: doc.mimeType as 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/jpg',
          documentType: extractionType,
        });

        if (result.success && result.data) {
          setExtractionResult(result.data);
          const itemCount = result.data.lineItems?.length ?? 0;
          toast.success(`Extracted ${itemCount} items from document`);
        } else {
          toast.error('No items found in document');
        }
      } catch (err) {
        console.error('Extraction error:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to extract items');
      } finally {
        setIsExtracting(false);
        setExtractingDocId(null);
      }
    },
    [trpcClient],
  );

  // Import extracted items to shipment
  const handleImport = useCallback(async () => {
    if (!extractionResult?.lineItems?.length) {
      toast.error('No items to import');
      return;
    }

    setIsImporting(true);

    try {
      const result = await trpcClient.logistics.admin.importExtractedItems.mutate({
        shipmentId,
        items: extractionResult.lineItems.map((item) => ({
          productName: item.productName,
          description: item.description,
          lwin: item.lwin,
          producer: item.producer,
          vintage: item.vintage,
          bottleSize: item.bottleSize,
          bottlesPerCase: item.bottlesPerCase,
          cases: item.cases,
          hsCode: item.hsCode,
          countryOfOrigin: item.countryOfOrigin,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        cargoSummary: extractionResult.totalCases
          ? {
              totalCases: extractionResult.totalCases,
              totalWeight: extractionResult.totalWeight,
            }
          : undefined,
      });

      toast.success(`Imported ${result.itemsImported} items to shipment`);
      setExtractionResult(null);
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getOne']] });
      onUploadComplete?.();
    } catch (err) {
      console.error('Import error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to import items');
    } finally {
      setIsImporting(false);
    }
  }, [extractionResult, shipmentId, trpcClient, queryClient, onUploadComplete]);

  const processFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadError(null);

      try {
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('File size must be less than 10MB');
        }

        // Upload directly to Vercel Blob (bypasses serverless 4.5MB body limit)
        const blob = await upload(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/upload/blob',
        });

        // Create database record with blob URL
        await createDocumentRecord({
          blobUrl: blob.url,
          filename: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
      } catch (err) {
        console.error('Error uploading file:', err);
        setUploadError(err instanceof Error ? err.message : 'Failed to upload file');
      } finally {
        setIsUploading(false);
      }
    },
    [createDocumentRecord],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        void processFile(file);
      }
    },
    [processFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string | null | undefined) => {
    if (mimeType?.startsWith('image/')) return IconPhoto;
    return IconFileText;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Upload Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Document Type
            </Typography>
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as DocumentType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(documentTypeLabels) as DocumentType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {documentTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <div
          {...getRootProps()}
          className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            isDragActive
              ? 'border-border-brand bg-surface-brand/5'
              : isUploading
                ? 'cursor-wait border-border-muted bg-fill-muted/50'
                : 'cursor-pointer border-border-muted hover:border-border-brand hover:bg-fill-muted/50'
          }`}
        >
          <input {...getInputProps()} />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Icon icon={IconLoader2} size="lg" className="animate-spin" colorRole="muted" />
              <Typography variant="bodySm" colorRole="muted">
                Uploading...
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
                  PDF, PNG, or JPG (max 10MB)
                </Typography>
              </div>
            </div>
          )}
        </div>

        {uploadError && (
          <div className="flex items-center gap-2 rounded-md bg-surface-danger/10 px-3 py-2">
            <Icon icon={IconX} size="sm" colorRole="danger" />
            <Typography variant="bodyXs" colorRole="danger">
              {uploadError}
            </Typography>
          </div>
        )}
      </div>

      {/* Uploaded Documents List */}
      {documents.length > 0 && (
        <div className="flex flex-col gap-2">
          <Typography variant="labelSm" colorRole="muted">
            Uploaded Documents ({documents.length})
          </Typography>
          <div className="flex flex-col gap-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border border-border-muted bg-fill-muted/30 px-3 py-2"
              >
                <Icon icon={getFileIcon(doc.mimeType)} size="md" colorRole="muted" />

                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <Typography variant="bodySm" className="truncate font-medium">
                      {doc.fileName}
                    </Typography>
                    <Badge colorRole="muted" size="sm">
                      {documentTypeLabels[doc.documentType as DocumentType] ?? doc.documentType}
                    </Badge>
                  </div>
                  <Typography variant="bodyXs" colorRole="muted">
                    {formatFileSize(doc.fileSize)}
                  </Typography>
                </div>

                <div className="flex items-center gap-1">
                  {extractableTypes.includes(doc.documentType as DocumentType) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExtract(doc)}
                      isDisabled={isExtracting}
                      title="Extract items with AI"
                    >
                      <Icon
                        icon={extractingDocId === doc.id ? IconLoader2 : IconSparkles}
                        size="sm"
                        className={extractingDocId === doc.id ? 'animate-spin' : ''}
                      />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" asChild>
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Icon icon={IconFile} size="sm" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    isDisabled={deleteMutation.isPending}
                  >
                    <Icon icon={IconTrash} size="sm" colorRole="danger" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extraction Results Panel */}
      {extractionResult && extractionResult.lineItems && extractionResult.lineItems.length > 0 && (
        <div className="rounded-lg border border-border-brand bg-surface-brand/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon icon={IconSparkles} size="md" colorRole="brand" />
              <Typography variant="headingSm">
                Extracted Items ({extractionResult.lineItems.length})
              </Typography>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setExtractionResult(null)}>
                <ButtonContent iconLeft={IconX}>Cancel</ButtonContent>
              </Button>
              <Button size="sm" onClick={handleImport} isDisabled={isImporting}>
                <ButtonContent iconLeft={isImporting ? IconLoader2 : IconPackageImport}>
                  {isImporting ? 'Importing...' : 'Import to Shipment'}
                </ButtonContent>
              </Button>
            </div>
          </div>

          {/* Cargo Summary */}
          {(extractionResult.totalCases || extractionResult.totalWeight) && (
            <div className="flex gap-4 mb-4 p-3 bg-fill-muted/50 rounded-md">
              {extractionResult.totalCases && (
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Total Cases
                  </Typography>
                  <Typography variant="headingSm">{extractionResult.totalCases}</Typography>
                </div>
              )}
              {extractionResult.totalWeight && (
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Total Weight
                  </Typography>
                  <Typography variant="headingSm">{extractionResult.totalWeight} kg</Typography>
                </div>
              )}
            </div>
          )}

          {/* Items Table */}
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-primary">
                <tr className="border-b border-border-muted text-left text-xs uppercase text-text-muted">
                  <th className="pb-2 pr-3">Product</th>
                  <th className="pb-2 pr-3">Vintage</th>
                  <th className="pb-2 pr-3 text-center">Pack</th>
                  <th className="pb-2 pr-3 text-right">Cases</th>
                  <th className="pb-2 pr-3">HS Code</th>
                  <th className="pb-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {extractionResult.lineItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-fill-muted/30">
                    <td className="py-2 pr-3">
                      <Typography variant="bodySm" className="font-medium">
                        {item.productName || item.description || '-'}
                      </Typography>
                      {item.producer && (
                        <Typography variant="bodyXs" colorRole="muted">
                          {item.producer}
                        </Typography>
                      )}
                    </td>
                    <td className="py-2 pr-3">{item.vintage || '-'}</td>
                    <td className="py-2 pr-3 text-center">
                      {item.bottlesPerCase || 12}x{item.bottleSize || '750ml'}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium">{item.cases || 1}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{item.hsCode || '-'}</td>
                    <td className="py-2 text-right">
                      {item.total ? `$${item.total.toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Import confirmation */}
          <div className="mt-4 pt-4 border-t border-border-muted flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon={IconCheck} size="sm" colorRole="success" />
              <Typography variant="bodySm" colorRole="muted">
                Ready to import {extractionResult.lineItems.length} items
              </Typography>
            </div>
            <Button size="sm" onClick={handleImport} isDisabled={isImporting}>
              <ButtonContent iconLeft={isImporting ? IconLoader2 : IconPackageImport}>
                {isImporting ? 'Importing...' : 'Import Items'}
              </ButtonContent>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogisticsDocumentUpload;
