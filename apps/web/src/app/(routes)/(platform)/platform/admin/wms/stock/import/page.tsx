'use client';

import {
  IconAlertCircle,
  IconCheck,
  IconLoader2,
  IconPackageImport,
  IconUpload,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
  quantity: number;
  unit: 'case' | 'bottle';
  bottlesPerCase: number;
  bottleSizeMl: number;
  locationCode: string;
}

/**
 * WMS Stock Import Page
 * Upload Zoho Inventory export to bulk import stock
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
    ...api.partners.listSimple.queryOptions({}),
  });

  // Fetch locations
  const { data: locationsData } = useQuery({
    ...api.wms.admin.locations.getMany.queryOptions({ limit: 100 }),
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

  const parseExcelFile = useCallback((file: File) => {
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
          setParseError('Could not find header row. Make sure the file has columns: sku, item_name, quantity_available');
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

        if (nameIndex === -1 || qtyIndex === -1) {
          setParseError('Missing required columns: item_name, quantity_available');
          return;
        }

        const items: ParsedItem[] = [];
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i] as (string | number)[];
          if (!row || row.length === 0) continue;

          const quantity = parseFloat(row[qtyIndex]?.toString() ?? '0');
          if (quantity <= 0) continue; // Skip items with no stock

          const unitStr = row[unitIndex]?.toString().toLowerCase() ?? 'case';
          const unit: 'case' | 'bottle' = unitStr.includes('bottle') ? 'bottle' : 'case';

          const productName = row[nameIndex]?.toString() ?? '';
          const sku = skuIndex >= 0 ? row[skuIndex]?.toString() ?? '' : '';

          // Parse case config from product name or SKU
          let bottlesPerCase = 6;
          let bottleSizeMl = 750;

          // Try to extract from product name (e.g., "6x75cl", "12x750ml")
          const packMatch = productName.match(/(\d+)\s*x\s*(\d+)\s*(cl|ml)/i);
          if (packMatch) {
            bottlesPerCase = parseInt(packMatch[1], 10);
            bottleSizeMl = parseInt(packMatch[2], 10);
            if (packMatch[3].toLowerCase() === 'cl') {
              bottleSizeMl *= 10;
            }
          } else if (sku && /^\d{15,18}$/.test(sku)) {
            // Try to extract from LWIN-style SKU
            const packConfig = sku.slice(-6);
            const extractedBpc = parseInt(packConfig.slice(0, 2), 10);
            const extractedSize = parseInt(packConfig.slice(2), 10);
            if (extractedBpc > 0 && extractedBpc <= 24) {
              bottlesPerCase = extractedBpc;
            }
            if (extractedSize > 0) {
              bottleSizeMl = extractedSize;
            }
          }

          const locationCode = locationIndex >= 0
            ? row[locationIndex]?.toString().trim() ?? ''
            : '';

          items.push({
            sku,
            productName,
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
    reader.readAsBinaryString(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResult(null);
      parseExcelFile(selectedFile);
    }
  };

  const caseItems = parsedItems.filter((item) => item.unit === 'case');
  const bottleItems = parsedItems.filter((item) => item.unit === 'bottle');
  const totalCases = caseItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasLocationColumn = caseItems.some((item) => item.locationCode);

  const handleImport = () => {
    if (!selectedOwnerId || parsedItems.length === 0) return;
    // Need either per-row locations or a global location selected
    if (!hasLocationColumn && !selectedLocationId) return;

    // Filter to only cases (bottles handled separately if needed)
    const filteredCaseItems = parsedItems.filter((item) => item.unit === 'case');

    importMutation.mutate({
      ownerId: selectedOwnerId,
      locationId: selectedLocationId || undefined,
      items: filteredCaseItems.map((item) => ({
        sku: item.sku,
        productName: item.productName,
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
        <div>
          <Typography variant="headingMd">Import Stock</Typography>
          <Typography variant="bodySm" colorRole="muted">
            Upload your Zoho Inventory export to bulk import stock into the WMS
          </Typography>
        </div>

        {/* Success Result */}
        {importResult?.success && (
          <Card className="border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Icon icon={IconCheck} className="text-emerald-600" size="lg" />
                <div>
                  <Typography variant="headingSm" className="text-emerald-800 dark:text-emerald-200">
                    Import Successful!
                  </Typography>
                  <Typography variant="bodySm" className="text-emerald-700 dark:text-emerald-300">
                    Imported {importResult.itemsImported} products ({importResult.totalCases} cases)
                    with {importResult.totalLabels} case labels. Lot #: {importResult.lotNumber}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Upload File */}
        <Card>
          <CardContent className="p-4">
            <Typography variant="headingSm" className="mb-4">
              1. Upload Zoho Export
            </Typography>
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border-primary p-8">
              <Icon icon={IconUpload} size="lg" colorRole="muted" className="mb-3" />
              <Typography variant="bodySm" colorRole="muted" className="mb-4 text-center">
                Upload your Inventory Summary export from Zoho
              </Typography>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" as="span" className="cursor-pointer">
                  <ButtonContent iconLeft={IconUpload}>Select File</ButtonContent>
                </Button>
              </label>
              {file && (
                <Typography variant="bodyXs" colorRole="muted" className="mt-2">
                  Selected: {file.name}
                </Typography>
              )}
            </div>
            {parseError && (
              <div className="mt-4 flex items-center gap-2 text-red-600">
                <Icon icon={IconAlertCircle} size="sm" />
                <Typography variant="bodyXs">{parseError}</Typography>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Preview */}
        {parsedItems.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <Typography variant="headingSm" className="mb-4">
                2. Preview Import ({parsedItems.length} items)
              </Typography>
              <div className="mb-4 grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-fill-secondary p-3 text-center">
                  <Typography variant="headingMd">{caseItems.length}</Typography>
                  <Typography variant="bodyXs" colorRole="muted">Case Products</Typography>
                </div>
                <div className="rounded-lg bg-fill-secondary p-3 text-center">
                  <Typography variant="headingMd">{totalCases}</Typography>
                  <Typography variant="bodyXs" colorRole="muted">Total Cases</Typography>
                </div>
                <div className="rounded-lg bg-fill-secondary p-3 text-center">
                  <Typography variant="headingMd">{bottleItems.length}</Typography>
                  <Typography variant="bodyXs" colorRole="muted">Bottle Items (skipped)</Typography>
                </div>
              </div>
              {/* Location distribution stats */}
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
                          {loc}: {qty} cases
                        </span>
                      ))}
                  </div>
                </div>
              )}
              <div className="max-h-64 overflow-y-auto rounded border border-border-primary">
                <table className="w-full text-sm">
                  <thead className="bg-fill-secondary sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-center">Pack</th>
                      {hasLocationColumn && (
                        <th className="px-3 py-2 text-center">Location</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {caseItems.slice(0, 50).map((item, i) => (
                      <tr key={i} className="border-t border-border-primary">
                        <td className="px-3 py-2">{item.productName}</td>
                        <td className="px-3 py-2 text-center">{item.quantity}</td>
                        <td className="px-3 py-2 text-center">
                          {item.bottlesPerCase}x{item.bottleSizeMl}ml
                        </td>
                        {hasLocationColumn && (
                          <td className="px-3 py-2 text-center">
                            {item.locationCode || (
                              <span className="text-red-500">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                    {caseItems.length > 50 && (
                      <tr className="border-t border-border-primary">
                        <td
                          colSpan={hasLocationColumn ? 4 : 3}
                          className="px-3 py-2 text-center text-text-muted"
                        >
                          ... and {caseItems.length - 50} more items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Configure & Import */}
        {parsedItems.length > 0 && !importResult?.success && (
          <Card>
            <CardContent className="p-4">
              <Typography variant="headingSm" className="mb-4">
                3. Configure Import
              </Typography>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <Typography variant="bodyXs" className="mb-1 font-medium">
                    Stock Owner
                  </Typography>
                  <select
                    value={selectedOwnerId}
                    onChange={(e) => setSelectedOwnerId(e.target.value)}
                    className="w-full rounded-lg border border-border-primary bg-fill-primary px-3 py-2"
                  >
                    <option value="">Select owner...</option>
                    {partnersData?.partners.map((partner) => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Typography variant="bodyXs" className="mb-1 font-medium">
                    {hasLocationColumn ? 'Fallback Location (optional)' : 'Receiving Location'}
                  </Typography>
                  <select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className="w-full rounded-lg border border-border-primary bg-fill-primary px-3 py-2"
                  >
                    <option value="">
                      {hasLocationColumn ? 'Using per-row locations...' : 'Select location...'}
                    </option>
                    {locationsData?.locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.locationCode}
                      </option>
                    ))}
                  </select>
                  {hasLocationColumn && (
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                      CSV has location_code column. Global location is only used for rows without one.
                    </Typography>
                  )}
                </div>
              </div>
              <Button
                variant="default"
                onClick={handleImport}
                disabled={
                  !selectedOwnerId ||
                  (!hasLocationColumn && !selectedLocationId) ||
                  importMutation.isPending
                }
                className="w-full"
              >
                <ButtonContent iconLeft={importMutation.isPending ? IconLoader2 : IconPackageImport}>
                  {importMutation.isPending
                    ? 'Importing...'
                    : `Import ${caseItems.length} Products (${totalCases} cases)`}
                </ButtonContent>
              </Button>
              {importMutation.isError && (
                <div className="mt-4 flex items-center gap-2 text-red-600">
                  <Icon icon={IconAlertCircle} size="sm" />
                  <Typography variant="bodyXs">{importMutation.error?.message}</Typography>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WMSStockImportPage;
