'use client';

import { IconCloudUpload, IconFileSpreadsheet, IconLoader2, IconX } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';

import parseSupplierSheet from '../utils/parseSupplierSheet';

interface UploadStepProps {
  onUploadComplete: (data: {
    fileName: string;
    headers: string[];
    rows: Record<string, unknown>[];
  }) => void;
}

/**
 * Step 1 of the pricing calculator wizard
 *
 * Allows uploading an Excel/CSV file or pasting a Google Sheet URL
 */
const UploadStep = ({ onUploadComplete }: UploadStepProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setError(null);
      setSelectedFile(file);

      try {
        const buffer = await file.arrayBuffer();
        const { headers, rows } = await parseSupplierSheet(buffer);

        if (rows.length === 0) {
          throw new Error('No data rows found in the file');
        }

        onUploadComplete({
          fileName: file.name,
          headers,
          rows,
        });
      } catch (err) {
        console.error('Error processing file:', err);
        setError(err instanceof Error ? err.message : 'Failed to process file');
        setSelectedFile(null);
      } finally {
        setIsProcessing(false);
      }
    },
    [onUploadComplete],
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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    disabled: isProcessing,
  });

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Drag & Drop Zone */}
      <div
        {...getRootProps()}
        className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragActive
            ? 'border-border-brand bg-surface-brand/5'
            : isProcessing
              ? 'cursor-wait border-border-muted bg-surface-secondary/50'
              : 'cursor-pointer border-border-muted hover:border-border-brand hover:bg-surface-secondary/50'
        }`}
      >
        <input {...getInputProps()} />

        {isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <Icon icon={IconLoader2} size="xl" colorRole="brand" className="animate-spin" />
            <Typography variant="bodySm" colorRole="muted">
              Processing {selectedFile?.name}...
            </Typography>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center gap-3">
            <Icon icon={IconFileSpreadsheet} size="xl" colorRole="brand" />
            <div>
              <Typography variant="bodySm" className="font-medium">
                {selectedFile.name}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Click or drag to replace
              </Typography>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
            >
              <ButtonContent iconLeft={IconX}>Clear</ButtonContent>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Icon icon={IconCloudUpload} size="xl" colorRole="muted" />
            <div>
              <Typography variant="bodySm" className="font-medium">
                {isDragActive ? 'Drop the file here' : 'Drag & drop supplier price sheet'}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                or click to browse • Supports .xlsx, .xls, .csv
              </Typography>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/20">
          <Typography variant="bodySm" className="text-red-600 dark:text-red-400">
            {error}
          </Typography>
        </div>
      )}

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-muted" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-sm text-text-muted dark:bg-background-primary">
            or
          </span>
        </div>
      </div>

      {/* Google Sheet URL Input */}
      <div className="space-y-2">
        <Typography variant="bodySm" className="font-medium">
          Paste Google Sheet URL
        </Typography>
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="flex-1"
            disabled
          />
          <Button variant="outline" disabled>
            Import
          </Button>
        </div>
        <Typography variant="bodyXs" colorRole="muted">
          Google Sheet import coming soon
        </Typography>
      </div>
    </div>
  );
};

export default UploadStep;
