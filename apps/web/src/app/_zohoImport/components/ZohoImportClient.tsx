'use client';

import {
  IconAlertTriangle,
  IconCheck,
  IconCloudUpload,
  IconDownload,
  IconEdit,
  IconLoader2,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import type { ZohoItem } from '../schemas/zohoItemSchema';

interface EditingCell {
  itemId: string;
  field: keyof ZohoItem;
}

/**
 * Main client component for Zoho Import tool
 *
 * Provides file upload, invoice extraction, preview, and CSV download functionality.
 */
const ZohoImportClient = () => {
  const api = useTRPC();

  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [extractedItems, setExtractedItems] = useState<ZohoItem[] | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [stats, setStats] = useState<{
    total: number;
    matched: number;
    unmatched: number;
    needsReview: number;
  } | null>(null);

  // Extract invoice mutation
  const { mutate: extractInvoice, isPending: isExtracting } = useMutation(
    api.zohoImport.admin.extractInvoice.mutationOptions({
      onSuccess: (data) => {
        setExtractedItems(data.items);
        setStats(data.stats);
        setExtractionError(null);
        if (data.supplierName && !supplierName) {
          setSupplierName(data.supplierName);
        }
      },
      onError: (error) => {
        setExtractionError(error.message);
        setExtractedItems(null);
        setStats(null);
      },
    }),
  );

  // Generate CSV mutation
  const { mutate: generateCsv, isPending: isGenerating } = useMutation(
    api.zohoImport.admin.generateZohoCsv.mutationOptions({
      onSuccess: (data) => {
        // Download the CSV
        const byteCharacters = atob(data.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.mimeType });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      },
      onError: (error) => {
        setExtractionError(`Failed to generate CSV: ${error.message}`);
      },
    }),
  );

  // Convert ArrayBuffer to base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  };

  // Process uploaded file
  const processFile = useCallback(
    async (file: File) => {
      if (!supplierName.trim()) {
        setExtractionError('Please enter a supplier name before uploading');
        return;
      }

      setUploadedFile(file);
      setExtractionError(null);
      setExtractedItems(null);
      setStats(null);

      try {
        const arrayBuffer = await file.arrayBuffer();

        if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
          throw new Error('File size must be less than 10MB');
        }

        const base64Content = arrayBufferToBase64(arrayBuffer);

        // Determine file type
        let fileType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/jpg' = 'application/pdf';
        if (file.type.startsWith('image/')) {
          fileType = file.type as 'image/png' | 'image/jpeg' | 'image/jpg';
        }

        extractInvoice({
          file: base64Content,
          fileType,
          supplierName: supplierName.trim(),
        });
      } catch (error) {
        setExtractionError(error instanceof Error ? error.message : 'Failed to read file');
      }
    },
    [extractInvoice, supplierName],
  );

  // Handle file drop
  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        await processFile(file);
      }
    },
    [processFile],
  );

  // Handle file input change
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await processFile(file);
      }
    },
    [processFile],
  );

  // Update stats helper
  const updateStats = (items: ZohoItem[]) => {
    setStats({
      total: items.length,
      matched: items.filter((i) => i.hasLwinMatch).length,
      unmatched: items.filter((i) => !i.hasLwinMatch).length,
      needsReview: items.filter((i) => i.needsReview).length,
    });
  };

  // Handle download CSV
  const handleDownloadCsv = () => {
    if (!extractedItems || extractedItems.length === 0) return;

    generateCsv({
      supplierName: supplierName.trim(),
      items: extractedItems,
    });
  };

  // Remove an item
  const handleRemoveItem = (itemId: string) => {
    if (!extractedItems) return;
    const newItems = extractedItems.filter((i) => i.id !== itemId);
    setExtractedItems(newItems);
    updateStats(newItems);
  };

  // Start editing a cell
  const startEditing = (itemId: string, field: keyof ZohoItem, currentValue: string | number | null) => {
    setEditingCell({ itemId, field });
    setEditValue(currentValue?.toString() ?? '');
  };

  // Save edited cell
  const saveEdit = () => {
    if (!editingCell || !extractedItems) return;

    const updatedItems = extractedItems.map((item) => {
      if (item.id !== editingCell.itemId) return item;

      const field = editingCell.field;
      let newValue: string | number | null = editValue;

      // Convert to appropriate type
      if (field === 'quantity' || field === 'caseConfig' || field === 'bottleSize') {
        newValue = parseInt(editValue, 10) || 0;
      }

      return { ...item, [field]: newValue };
    });

    setExtractedItems(updatedItems);
    setEditingCell(null);
    setEditValue('');
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Handle key press in edit input
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // Clear and reset
  const handleClear = () => {
    setUploadedFile(null);
    setExtractedItems(null);
    setStats(null);
    setExtractionError(null);
    setEditingCell(null);
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-green-600';
    if (confidence >= 0.4) return 'text-amber-600';
    return 'text-red-600';
  };

  // Get row background color
  const getRowBgColor = (item: ZohoItem) => {
    if (!item.hasLwinMatch) return 'bg-red-50/50';
    if (item.needsReview) return 'bg-amber-50/50';
    return '';
  };

  // Render editable cell
  const renderEditableCell = (
    item: ZohoItem,
    field: keyof ZohoItem,
    value: string | number | null,
    className?: string,
  ) => {
    const isEditing = editingCell?.itemId === item.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <input
          type={field === 'quantity' || field === 'caseConfig' || field === 'bottleSize' ? 'number' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleEditKeyDown}
          autoFocus
          className="w-full px-1 py-0.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      );
    }

    return (
      <button
        type="button"
        onClick={() => startEditing(item.id, field, value)}
        className={`group flex items-center gap-1 text-left hover:bg-fill-muted/50 rounded px-1 py-0.5 -mx-1 w-full ${className ?? ''}`}
        title="Click to edit"
      >
        <span className="flex-1 min-w-0">{value ?? '-'}</span>
        <IconEdit className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-100 flex-shrink-0" />
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Supplier Name Input */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1.5">
          Supplier Name <span className="text-red-500">*</span>
        </label>
        <Input
          type="text"
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          placeholder="e.g., Cult Wines Ltd"
          isDisabled={isExtracting || !!extractedItems}
        />
        <Typography variant="bodyXs" colorRole="muted" className="mt-1">
          This will be used as the Preferred Vendor in Zoho
        </Typography>
      </div>

      {/* File Upload Zone */}
      {!extractedItems && (
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver ? 'border-blue-500 bg-blue-50' : 'border-border-muted hover:border-border-primary'
          } ${!supplierName.trim() ? 'opacity-50 pointer-events-none' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {isExtracting ? (
            <div className="flex flex-col items-center gap-3">
              <IconLoader2 className="h-10 w-10 text-blue-500 animate-spin" />
              <Typography variant="bodyMd" colorRole="muted">
                Extracting invoice data...
              </Typography>
              {uploadedFile && (
                <Typography variant="bodyXs" colorRole="muted">
                  {uploadedFile.name}
                </Typography>
              )}
            </div>
          ) : (
            <>
              <IconCloudUpload className="h-10 w-10 text-text-muted mx-auto mb-3" />
              <Typography variant="bodyMd" className="font-medium">
                Drop invoice PDF here
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mb-3">
                or click to browse (PDF, PNG, JPG)
              </Typography>
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={!supplierName.trim()}
              />
            </>
          )}
        </div>
      )}

      {/* Error Display */}
      {extractionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <IconAlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <Typography variant="bodyMd" className="font-medium text-red-800">
              Extraction Failed
            </Typography>
            <Typography variant="bodyXs" className="text-red-600">
              {extractionError}
            </Typography>
          </div>
          <button type="button" onClick={() => setExtractionError(null)} className="p-1 hover:bg-red-100 rounded">
            <IconX className="h-4 w-4 text-red-600" />
          </button>
        </div>
      )}

      {/* Results */}
      {extractedItems && stats && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="p-4 bg-fill-success/5 border border-border-success rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <IconCheck className="h-5 w-5 text-text-success" />
              <div className="flex-1">
                <Typography variant="bodyMd" className="font-medium">
                  Extracted {stats.total} items from {uploadedFile?.name}
                </Typography>
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="p-1 hover:bg-fill-muted rounded"
                title="Clear and upload different file"
              >
                <IconTrash className="h-4 w-4 text-text-muted" />
              </button>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                {stats.matched} matched
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                {stats.unmatched} unmatched
              </span>
              {stats.needsReview > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <IconAlertTriangle className="h-4 w-4" />
                  {stats.needsReview} need review
                </span>
              )}
            </div>
          </div>

          {/* Editing hint */}
          <Typography variant="bodyXs" colorRole="muted" className="flex items-center gap-1">
            <IconEdit className="h-3.5 w-3.5" />
            Click any cell to edit. Press Enter to save, Escape to cancel.
          </Typography>

          {/* Items - Card Layout for mobile, Table for desktop */}
          <div className="space-y-3 md:hidden">
            {extractedItems.map((item) => (
              <div
                key={item.id}
                className={`border border-border-muted rounded-lg p-4 space-y-3 ${getRowBgColor(item)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {renderEditableCell(item, 'productName', item.productName)}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                      <span>Vintage:</span>
                      {renderEditableCell(item, 'vintage', item.vintage)}
                      <span className="text-border-muted">|</span>
                      {renderEditableCell(item, 'caseConfig', item.caseConfig)}
                      <span>x</span>
                      {renderEditableCell(item, 'bottleSize', item.bottleSize)}
                      <span>ml</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1 hover:bg-red-50 rounded"
                    title="Remove"
                  >
                    <IconTrash className="h-4 w-4 text-red-500" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-text-muted">LWIN:</span>{' '}
                    <span className={item.hasLwinMatch ? 'text-green-600' : 'text-red-600'}>
                      {item.hasLwinMatch ? item.lwin7 : 'No match'}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Confidence:</span>{' '}
                    <span className={getConfidenceColor(item.matchConfidence)}>
                      {Math.round(item.matchConfidence * 100)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Country:</span>{' '}
                    {renderEditableCell(item, 'country', item.country)}
                  </div>
                  <div>
                    <span className="text-text-muted">HS Code:</span>{' '}
                    {renderEditableCell(item, 'hsCode', item.hsCode, 'font-mono')}
                  </div>
                  <div>
                    <span className="text-text-muted">SKU:</span>{' '}
                    <span className="font-mono text-text-muted">{item.sku}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Qty:</span>{' '}
                    {renderEditableCell(item, 'quantity', item.quantity)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block border border-border-muted rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-border-muted text-sm">
                <thead className="bg-fill-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted min-w-[300px]">Product</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted w-24">LWIN</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted w-20">Conf.</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted w-24">Country</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted w-24">HS Code</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted w-16">Qty</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {extractedItems.map((item) => (
                    <tr key={item.id} className={getRowBgColor(item)}>
                      <td className="px-3 py-2">
                        <div>
                          {renderEditableCell(item, 'productName', item.productName, 'font-medium')}
                          <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                            {renderEditableCell(item, 'vintage', item.vintage)}
                            <span className="text-border-muted mx-1">•</span>
                            {renderEditableCell(item, 'caseConfig', item.caseConfig)}
                            <span>x</span>
                            {renderEditableCell(item, 'bottleSize', item.bottleSize)}
                            <span>ml</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {item.hasLwinMatch ? (
                          <span className="text-green-600 text-xs">{item.lwin7}</span>
                        ) : (
                          <span className="text-red-600 text-xs">No match</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-medium ${getConfidenceColor(item.matchConfidence)}`}>
                          {Math.round(item.matchConfidence * 100)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {renderEditableCell(item, 'country', item.country)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {renderEditableCell(item, 'hsCode', item.hsCode, 'font-mono')}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {renderEditableCell(item, 'quantity', item.quantity)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 hover:bg-red-50 rounded"
                          title="Remove"
                        >
                          <IconTrash className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Warning for unmatched items */}
          {stats.unmatched > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <IconAlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <Typography variant="bodyXs" className="text-amber-800">
                {stats.unmatched} item{stats.unmatched > 1 ? 's' : ''} could not be matched to the LWIN database. These
                will have placeholder SKUs and may need manual correction in Zoho.
              </Typography>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" onClick={handleClear}>
              <ButtonContent iconLeft={IconX}>Start Over</ButtonContent>
            </Button>
            <Button
              variant="default"
              colorRole="brand"
              onClick={handleDownloadCsv}
              isDisabled={extractedItems.length === 0 || isGenerating}
            >
              <ButtonContent iconLeft={isGenerating ? IconLoader2 : IconDownload}>
                {isGenerating ? 'Generating...' : `Download CSV (${extractedItems.length} items)`}
              </ButtonContent>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZohoImportClient;
