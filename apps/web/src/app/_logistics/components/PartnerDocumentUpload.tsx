'use client';

import {
  IconCloudUpload,
  IconFile,
  IconFileText,
  IconLoader2,
  IconPhoto,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { LogisticsDocument } from '@/database/schema';
import { useTRPCClient } from '@/lib/trpc/browser';

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

interface PartnerDocumentUploadProps {
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
 * Partner document upload component for logistics shipments
 *
 * Allows partners to upload documents for their shipments using drag-and-drop.
 */
const PartnerDocumentUpload = ({
  shipmentId,
  documents = [],
  onUploadComplete,
}: PartnerDocumentUploadProps) => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState<DocumentType>('commercial_invoice');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Upload mutation using partner endpoint
  const { mutateAsync: uploadDocument } = useMutation({
    mutationFn: async (data: { file: string; filename: string; fileType: string }) => {
      return trpcClient.logistics.partner.uploadDocument.mutate({
        shipmentId,
        documentType: selectedType,
        file: data.file,
        filename: data.filename,
        fileType: data.fileType as 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/jpg',
      });
    },
    onSuccess: () => {
      toast.success('Document uploaded successfully');
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'partner', 'getOne']] });
      onUploadComplete?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to upload document');
    },
  });

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
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
        });
        reader.readAsDataURL(file);
        const base64 = await base64Promise;

        await uploadDocument({
          file: base64,
          filename: file.name,
          fileType: file.type,
        });
      } catch (err) {
        console.error('Error uploading file:', err);
        setUploadError(err instanceof Error ? err.message : 'Failed to upload file');
      } finally {
        setIsUploading(false);
      }
    },
    [uploadDocument],
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
                  <Button variant="ghost" size="sm" asChild>
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Icon icon={IconFile} size="sm" />
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerDocumentUpload;
