'use client';

import {
  IconAlertCircle,
  IconCheck,
  IconDownload,
  IconLoader2,
  IconPackageImport,
  IconUpload,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

interface ParsedItem {
  sku: string;
  productName: string;
  producer: string;
  vintage: string;
  quantity: number;
  unit: 'case' | 'bottle';
  bottlesPerCase: number;
  bottleSizeMl: number;
  locationCode: string;
}

/**
 * WMS Stock Import Page
 * Upload CSV/Excel to bulk import stock into the WMS
 */
const WMSStockImportPage = () => {
  const api = useTRPC();

  const [file, setFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [importResult, setImportResult] = useState<{
    success: boolean;
    itemsImported: number;
    totalCases: number;
    totalLabels: number;
    lotNumber: string;
  } | null>(null);

  // Fetch partners for owner selection
  const { data: partnersData } = useQuery({
    ...api.partners.list.queryOptions({}),
  });

  // Fetch locations
  const { data: locationsData } = useQuery({
    ...api.wms.admin.locations.getMany.queryOptions({}),
  });

  // Import mutation
  const importMutation = useMutation({
    ...api.wms.admin.stock.import.mutationOptions(),
    onSuccess: (data) => {
      setImportResult({
        success: data.success,
        itemsImported: data.itemsImported,
        totalCases: data.totalCases,
        totalLabels: data.totalLabels,
        lotNumber: data.lotNumber,
      });
    },
  });

  const parseExcelFile = useCallback((uploadedFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName!];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 }) as unknown[][];

        // Find the header row (contains 'item_name' or 'sku')
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const row = rows[i] as string[];
          if (row?.some((cell) => cell?.toString().toLowerCase() === 'item_name' || cell?.toString().toLowerCase() === 'sku')) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          setParseError('Could not find header row. Expected columns: item_name, quantity_available');
          return;
        }

        const headers = (rows[headerRowIndex] as string[]).map((h) => h?.toString().toLowerCase().trim());
        const skuIndex = headers.indexOf('sku');
        const nameIndex = headers.indexOf('item_name');
        const qtyIndex = headers.indexOf('quantity_available');
        const unitIndex = headers.indexOf('unit');
        const locationIndex = Math.max(
          headers.indexOf('location_code'),
          headers.indexOf('location'),
        );
        const producerIndex = headers.indexOf('producer');
        const vintageIndex = headers.indexOf('vintage');
        const bpcIndex = headers.indexOf('bottles_per_case');
        const sizeIndex = Math.max(
          headers.indexOf('bottle_size_cl'),
          headers.indexOf('bottle_size_ml'),
        );
        const sizeIsCl = headers.indexOf('bottle_size_cl') >= 0;

        if (nameIndex === -1 || qtyIndex === -1) {
          setParseError('Missing required columns: item_name, quantity_available');
          return;
        }

        const items: ParsedItem[] = [];
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i] as (string | number)[];
          if (!row || row.length === 0) continue;

          const quantity = parseFloat(row[qtyIndex]?.toString() ?? '0');
          if (quantity <= 0) continue;

          const unitStr = row[unitIndex]?.toString().toLowerCase() ?? 'case';
          const unit: 'case' | 'bottle' = unitStr.includes('bottle') ? 'bottle' : 'case';

          const productName = row[nameIndex]?.toString() ?? '';
          const sku = skuIndex >= 0 ? row[skuIndex]?.toString() ?? '' : '';
          const producer = producerIndex >= 0 ? row[producerIndex]?.toString().trim() ?? '' : '';
          const vintage = vintageIndex >= 0 ? row[vintageIndex]?.toString().trim() ?? '' : '';

          // Parse case config: explicit columns > product name > SKU > defaults
          let bottlesPerCase = 6;
          let bottleSizeMl = 750;

          // 1. Check explicit columns first
          const explicitBpc = bpcIndex >= 0 ? parseInt(row[bpcIndex]?.toString() ?? '', 10) : NaN;
          const explicitSize = sizeIndex >= 0 ? parseInt(row[sizeIndex]?.toString() ?? '', 10) : NaN;

          if (!isNaN(explicitBpc) && explicitBpc > 0 && explicitBpc <= 24) {
            bottlesPerCase = explicitBpc;
          }
          if (!isNaN(explicitSize) && explicitSize > 0) {
            bottleSizeMl = sizeIsCl ? explicitSize * 10 : explicitSize;
          }

          // 2. Fall back to product name detection if not explicitly set
          if (isNaN(explicitBpc) || isNaN(explicitSize)) {
            const packMatch = productName.match(/(\d+)\s*x\s*(\d+)\s*(cl|ml)/i);
            if (packMatch) {
              if (isNaN(explicitBpc)) bottlesPerCase = parseInt(packMatch[1], 10);
              let parsedSize = parseInt(packMatch[2], 10);
              if (packMatch[3].toLowerCase() === 'cl') parsedSize *= 10;
              if (isNaN(explicitSize)) bottleSizeMl = parsedSize;
            } else if (sku && /^\d{15,18}$/.test(sku)) {
              // 3. Fall back to SKU-based extraction
              const packConfig = sku.slice(-6);
              const extractedBpc = parseInt(packConfig.slice(0, 2), 10);
              const extractedSize = parseInt(packConfig.slice(2), 10);
              if (isNaN(explicitBpc) && extractedBpc > 0 && extractedBpc <= 24) {
                bottlesPerCase = extractedBpc;
              }
              if (isNaN(explicitSize) && extractedSize > 0) {
                bottleSizeMl = extractedSize;
              }
            }
          }

          const locationCode = locationIndex >= 0
            ? row[locationIndex]?.toString().trim() ?? ''
            : '';

          items.push({
            sku,
            productName,
            producer,
            vintage,
            quantity: Math.floor(quantity),
            unit,
            bottlesPerCase,
            bottleSizeMl,
            locationCode,
          });
        }

        setParsedItems(items);
        setParseError(null);
      } catch (err) {
        setParseError(`Error parsing file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    reader.readAsBinaryString(uploadedFile);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResult(null);
      parseExcelFile(selectedFile);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedItems([]);
    setParseError(null);
    setImportResult(null);
  };

  const caseItems = parsedItems.filter((item) => item.unit === 'case');
  const bottleItems = parsedItems.filter((item) => item.unit === 'bottle');
  const totalCases = caseItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasLocationColumn = caseItems.some((item) => item.locationCode);

  const selectedOwnerName = partnersData?.find((p) => p.id === selectedOwnerId)?.name ?? '';

  const canImport =
    selectedOwnerId &&
    caseItems.length > 0 &&
    (hasLocationColumn || selectedLocationId) &&
    !importMutation.isPending;

  const handleImport = () => {
    if (!canImport) return;

    importMutation.mutate({
      ownerId: selectedOwnerId,
      locationId: selectedLocationId || undefined,
      items: caseItems.map((item) => ({
        sku: item.sku,
        productName: item.productName,
        producer: item.producer || undefined,
        vintage: item.vintage || undefined,
        quantity: item.quantity,
        unit: item.unit,
        bottlesPerCase: item.bottlesPerCase,
        bottleSizeMl: item.bottleSizeMl,
        locationCode: item.locationCode || undefined,
      })),
      notes: `Imported from ${file?.name}`,
    });
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Typography variant="headingMd">Import Stock</Typography>
            <Typography variant="bodySm" colorRole="muted">
              Bulk import inventory into the WMS — one upload per stock owner
            </Typography>
          </div>
          <Link href="/docs/wms-stock-import-template.csv" download>
            <Button variant="ghost" size="sm">
              <IconDownload className="mr-1.5 h-4 w-4" />
              Template
            </Button>
          </Link>
        </div>

        {/* Success Result */}
        {importResult?.success && (
          <Card className="border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Icon icon={IconCheck} className="text-emerald-600" size="lg" />
                <div className="flex-1">
                  <Typography variant="headingSm" className="text-emerald-800 dark:text-emerald-200">
                    Import Successful
                  </Typography>
                  <Typography variant="bodySm" className="text-emerald-700 dark:text-emerald-300">
                    {importResult.itemsImported} products ({importResult.totalCases} cases)
                    imported with {importResult.totalLabels} case labels. Lot: {importResult.lotNumber}
                  </Typography>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Import More
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!importResult?.success && (
          <>
            {/* Step 1: Select Owner & Location */}
            <Card>
              <CardContent className="p-4">
                <Typography variant="headingSm" className="mb-1">
                  1. Who owns this stock?
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mb-4">
                  All items in this upload will be assigned to the selected owner. Import separate files for each owner.
                </Typography>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Typography variant="bodyXs" className="mb-1.5 font-medium">
                      Stock Owner
                    </Typography>
                    <select
                      value={selectedOwnerId}
                      onChange={(e) => setSelectedOwnerId(e.target.value)}
                      className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2.5 text-sm focus:border-border-brand focus:outline-none focus:ring-1 focus:ring-border-brand"
                    >
                      <option value="">Select owner...</option>
                      {partnersData?.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Typography variant="bodyXs" className="mb-1.5 font-medium">
                      Default Location
                    </Typography>
                    <select
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2.5 text-sm focus:border-border-brand focus:outline-none focus:ring-1 focus:ring-border-brand"
                    >
                      <option value="">Select location...</option>
                      {locationsData?.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.locationCode} ({location.locationType})
                        </option>
                      ))}
                    </select>
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                      Used for all items. Override per-row with a location_code column in your file.
                    </Typography>
                  </div>
                </div>
                {selectedOwnerId && (
                  <div className="mt-3 flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                    <IconCheck className="h-3.5 w-3.5" />
                    Importing as <span className="font-semibold">{selectedOwnerName}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Upload File */}
            <Card className={!selectedOwnerId ? 'opacity-50' : ''}>
              <CardContent className="p-4">
                <Typography variant="headingSm" className="mb-1">
                  2. Upload inventory file
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mb-4">
                  CSV or Excel with columns: <code className="rounded bg-surface-muted px-1 py-0.5 text-[11px]">item_name</code>,{' '}
                  <code className="rounded bg-surface-muted px-1 py-0.5 text-[11px]">quantity_available</code>.
                  Optional: <code className="rounded bg-surface-muted px-1 py-0.5 text-[11px]">producer</code>,{' '}
                  <code className="rounded bg-surface-muted px-1 py-0.5 text-[11px]">vintage</code>,{' '}
                  <code className="rounded bg-surface-muted px-1 py-0.5 text-[11px]">bottles_per_case</code>,{' '}
                  <code className="rounded bg-surface-muted px-1 py-0.5 text-[11px]">bottle_size_cl</code>,{' '}
                  <code className="rounded bg-surface-muted px-1 py-0.5 text-[11px]">location_code</code>,{' '}
                  <code className="rounded bg-surface-muted px-1 py-0.5 text-[11px]">sku</code>,{' '}
                  <code className="rounded bg-surface-muted px-1 py-0.5 text-[11px]">unit</code>
                </Typography>
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border-primary p-6">
                  <Icon icon={IconUpload} size="lg" colorRole="muted" className="mb-2" />
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    disabled={!selectedOwnerId}
                  />
                  <label htmlFor="file-upload">
                    <span className={`${selectedOwnerId ? 'cursor-pointer' : 'pointer-events-none'}`}>
                      <Button variant="outline" asChild>
                        <span>
                          <ButtonContent iconLeft={IconUpload}>Select File</ButtonContent>
                        </span>
                      </Button>
                    </span>
                  </label>
                  {file && (
                    <Typography variant="bodyXs" colorRole="muted" className="mt-2">
                      {file.name}
                    </Typography>
                  )}
                </div>
                {parseError && (
                  <div className="mt-3 flex items-center gap-2 text-red-600">
                    <Icon icon={IconAlertCircle} size="sm" />
                    <Typography variant="bodyXs">{parseError}</Typography>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 3: Preview & Confirm */}
            {caseItems.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <Typography variant="headingSm" className="mb-4">
                    3. Review & Import
                  </Typography>

                  {/* Summary stats */}
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-fill-secondary p-3 text-center">
                      <div className="text-lg font-bold">{caseItems.length}</div>
                      <Typography variant="bodyXs" colorRole="muted">Products</Typography>
                    </div>
                    <div className="rounded-lg bg-fill-secondary p-3 text-center">
                      <div className="text-lg font-bold">{totalCases}</div>
                      <Typography variant="bodyXs" colorRole="muted">Total Cases</Typography>
                    </div>
                    <div className="rounded-lg bg-fill-secondary p-3 text-center">
                      <div className="text-lg font-bold">{bottleItems.length}</div>
                      <Typography variant="bodyXs" colorRole="muted">Bottles (skipped)</Typography>
                    </div>
                  </div>

                  {/* Owner confirmation */}
                  <div className="mb-4 rounded-lg border border-border-primary p-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-text-muted">Owner:</span>{' '}
                        <span className="font-medium">{selectedOwnerName || '—'}</span>
                      </div>
                      <div>
                        <span className="text-text-muted">Location:</span>{' '}
                        <span className="font-medium">
                          {hasLocationColumn
                            ? 'Per-row (from file)'
                            : locationsData?.find((l) => l.id === selectedLocationId)?.locationCode ?? '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Location distribution */}
                  {hasLocationColumn && (
                    <div className="mb-4 rounded-lg border border-border-primary p-3">
                      <Typography variant="bodyXs" className="mb-2 font-medium">
                        Location Distribution
                      </Typography>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(
                          caseItems.reduce<Record<string, number>>((acc, item) => {
                            const loc = item.locationCode || 'No location';
                            acc[loc] = (acc[loc] ?? 0) + item.quantity;
                            return acc;
                          }, {}),
                        )
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([loc, qty]) => (
                            <span
                              key={loc}
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                loc === 'No location'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                  : 'bg-fill-secondary text-text-primary'
                              }`}
                            >
                              {loc}: {qty} cs
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Item preview table */}
                  <div className="mb-4 max-h-64 overflow-y-auto rounded border border-border-primary">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-fill-secondary">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">Product</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">Producer</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-text-muted">Vintage</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-text-muted">Qty</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-text-muted">Pack</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-text-muted">Size</th>
                          {hasLocationColumn && (
                            <th className="px-3 py-2 text-center text-xs font-medium text-text-muted">Location</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {caseItems.slice(0, 50).map((item, i) => (
                          <tr key={i} className="border-t border-border-primary">
                            <td className="px-3 py-2">{item.productName}</td>
                            <td className="px-3 py-2 text-text-muted">{item.producer || '—'}</td>
                            <td className="px-3 py-2 text-center tabular-nums text-text-muted">{item.vintage || '—'}</td>
                            <td className="px-3 py-2 text-center tabular-nums font-medium">{item.quantity}</td>
                            <td className="px-3 py-2 text-center tabular-nums text-text-muted">
                              {item.bottlesPerCase}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums text-text-muted">
                              {item.bottleSizeMl / 10}cl
                            </td>
                            {hasLocationColumn && (
                              <td className="px-3 py-2 text-center font-mono text-xs">
                                {item.locationCode || (
                                  <span className="text-text-muted">default</span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                        {caseItems.length > 50 && (
                          <tr className="border-t border-border-primary">
                            <td
                              colSpan={hasLocationColumn ? 7 : 6}
                              className="px-3 py-2 text-center text-text-muted"
                            >
                              ... and {caseItems.length - 50} more
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Import button */}
                  <Button
                    variant="default"
                    onClick={handleImport}
                    disabled={!canImport}
                    className="w-full"
                  >
                    <ButtonContent iconLeft={importMutation.isPending ? IconLoader2 : IconPackageImport}>
                      {importMutation.isPending
                        ? 'Importing...'
                        : `Import ${caseItems.length} Products (${totalCases} cases) as ${selectedOwnerName}`}
                    </ButtonContent>
                  </Button>

                  {!selectedOwnerId && (
                    <Typography variant="bodyXs" className="mt-2 text-center text-amber-600">
                      Select a stock owner above before importing
                    </Typography>
                  )}
                  {!hasLocationColumn && !selectedLocationId && selectedOwnerId && (
                    <Typography variant="bodyXs" className="mt-2 text-center text-amber-600">
                      Select a default location above, or add a location_code column to your file
                    </Typography>
                  )}

                  {importMutation.isError && (
                    <div className="mt-3 flex items-center gap-2 text-red-600">
                      <Icon icon={IconAlertCircle} size="sm" />
                      <Typography variant="bodyXs">{importMutation.error?.message}</Typography>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WMSStockImportPage;
