'use client';

import {
  IconCloudUpload,
  IconFile,
  IconFileText,
  IconLoader2,
  IconPhoto,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useTRPCClient } from '@/lib/trpc/browser';

type DocumentType = 'partner_invoice' | 'cc_invoice' | 'distributor_invoice' | 'payment_proof';

interface DocumentUploadProps {
  orderId: string;
  allowedTypes?: DocumentType[];
}

const documentTypeLabels: Record<DocumentType, string> = {
  partner_invoice: 'Partner Invoice',
  cc_invoice: 'C&C Invoice',
  distributor_invoice: 'Distributor Invoice',
  payment_proof: 'Payment Proof',
};

const extractionStatusConfig: Record<string, { label: string; colorRole: 'muted' | 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'Pending', colorRole: 'muted' },
  processing: { label: 'Processing', colorRole: 'warning' },
  completed: { label: 'Extracted', colorRole: 'success' },
  failed: { label: 'Failed', colorRole: 'danger' },
};

/**
 * Document upload component for private client orders
 *
 * Supports drag-and-drop upload of invoices and payment proofs.
 * Displays uploaded documents with extraction status.
 */
const DocumentUpload = ({
  orderId,
  allowedTypes = ['partner_invoice', 'cc_invoice', 'distributor_invoice', 'payment_proof'],
}: DocumentUploadProps) => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState<DocumentType>(allowedTypes[0] ?? 'partner_invoice');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Fetch documents for this order
  const documentsQuery = useQuery({
    queryKey: ['privateClientOrderDocuments', orderId],
    queryFn: () => trpcClient.privateClientOrders.getDocuments.query({ orderId }),
  });

  // Upload mutation
  const { mutateAsync: uploadDocument } = useMutation({
    mutationFn: async (data: { file: string; filename: string; fileType: string }) => {
      return trpcClient.privateClientOrders.uploadDocument.mutate({
        orderId,
        documentType: selectedType,
        file: data.file,
        filename: data.filename,
        fileType: data.fileType as 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/jpg',
      });
    },
    onSuccess: () => {
      toast.success('Document uploaded successfully');
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrderDocuments', orderId] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to upload document');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return trpcClient.privateClientOrders.deleteDocument.mutate({ documentId });
    },
    onSuccess: () => {
      toast.success('Document deleted');
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrderDocuments', orderId] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete document');
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string | null) => {
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
                {allowedTypes.map((type) => (
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
      {documentsQuery.data && documentsQuery.data.length > 0 && (
        <div className="flex flex-col gap-2">
          <Typography variant="labelSm" colorRole="muted">
            Uploaded Documents
          </Typography>
          <div className="flex flex-col gap-2">
            {documentsQuery.data.map((doc) => (
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
                      {documentTypeLabels[doc.documentType as DocumentType]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Typography variant="bodyXs" colorRole="muted">
                      {formatFileSize(doc.fileSize)}
                    </Typography>
                    {doc.extractionStatus && (
                      <Badge
                        size="sm"
                        colorRole={extractionStatusConfig[doc.extractionStatus]?.colorRole || 'muted'}
                      >
                        {extractionStatusConfig[doc.extractionStatus]?.label || doc.extractionStatus}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
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

      {documentsQuery.isLoading && (
        <div className="flex items-center justify-center py-4">
          <Icon icon={IconLoader2} size="md" className="animate-spin" colorRole="muted" />
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
