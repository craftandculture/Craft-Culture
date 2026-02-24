'use client';

import {
  IconAlertCircle,
  IconAlertTriangle,
  IconBottle,
  IconCheck,
  IconCircleCheck,
  IconCircleX,
  IconDownload,
  IconLoader2,
  IconMapPin,
  IconPackageImport,
  IconSearch,
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
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

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
  category: string;
}

interface LwinCandidate {
  lwin: string;
  displayName: string;
  producerName: string | null;
  country: string | null;
  region: string | null;
  type: string | null;
}

interface ValidationResult {
  rowIndex: number;
  status: 'matched' | 'ambiguous' | 'no_match' | 'spirit' | 'error';
  lwin: LwinCandidate | null;
  candidates: LwinCandidate[];
  locationValid: boolean | null;
  errors: string[];
}

/**
 * WMS Stock Import Page
 * Upload CSV/Excel to bulk import stock into the WMS with LWIN validation
 */
const WMSStockImportPage = () => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();

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

  // Validation state
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationComplete, setValidationComplete] = useState(false);

  // LWIN search for manual resolution
  const [searchingRowIndex, setSearchingRowIndex] = useState<number | null>(null);
  const [lwinSearchQuery, setLwinSearchQuery] = useState('');
  const [lwinSearchResults, setLwinSearchResults] = useState<LwinCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Manual LWIN entry
  const [manualLwinRowIndex, setManualLwinRowIndex] = useState<number | null>(null);
  const [manualLwinValue, setManualLwinValue] = useState('');

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
        const categoryIndex = headers.indexOf('category');

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
          const category = categoryIndex >= 0 ? row[categoryIndex]?.toString().trim() ?? '' : '';

          // Parse case config: explicit columns > product name > SKU > defaults
          let bottlesPerCase = 6;
          let bottleSizeMl = 750;

          const explicitBpc = bpcIndex >= 0 ? parseInt(row[bpcIndex]?.toString() ?? '', 10) : NaN;
          const explicitSize = sizeIndex >= 0 ? parseInt(row[sizeIndex]?.toString() ?? '', 10) : NaN;

          if (!isNaN(explicitBpc) && explicitBpc > 0 && explicitBpc <= 24) {
            bottlesPerCase = explicitBpc;
          }
          if (!isNaN(explicitSize) && explicitSize > 0) {
            bottleSizeMl = sizeIsCl ? explicitSize * 10 : explicitSize;
          }

          if (isNaN(explicitBpc) || isNaN(explicitSize)) {
            const packMatch = productName.match(/(\d+)\s*x\s*(\d+)\s*(cl|ml)/i);
            if (packMatch) {
              if (isNaN(explicitBpc)) bottlesPerCase = parseInt(packMatch[1], 10);
              let parsedSize = parseInt(packMatch[2], 10);
              if (packMatch[3].toLowerCase() === 'cl') parsedSize *= 10;
              if (isNaN(explicitSize)) bottleSizeMl = parsedSize;
            } else if (sku && /^\d{15,18}$/.test(sku)) {
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
            category,
          });
        }

        setParsedItems(items);
        setParseError(null);
        // Reset validation when new file is parsed
        setValidationResults([]);
        setValidationComplete(false);
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
    setValidationResults([]);
    setValidationComplete(false);
    setSearchingRowIndex(null);
    setManualLwinRowIndex(null);
    setManualLwinValue('');
  };

  const caseItems = parsedItems.filter((item) => item.unit === 'case');
  const bottleItems = parsedItems.filter((item) => item.unit === 'bottle');
  const totalCases = caseItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasLocationColumn = caseItems.some((item) => item.locationCode);

  // Run validation against LWIN database
  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const result = await trpcClient.wms.admin.stock.validateImport.mutate({
        items: caseItems.map((item) => ({
          productName: item.productName,
          producer: item.producer || undefined,
          vintage: item.vintage || undefined,
          sku: item.sku || undefined,
          locationCode: item.locationCode || undefined,
          category: item.category || undefined,
        })),
      });
      setValidationResults(result.results);
      setValidationComplete(true);
    } catch (err) {
      setParseError(`Validation error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsValidating(false);
    }
  };

  // Resolve an ambiguous/no_match row by selecting a candidate
  const handleSelectLwin = (rowIndex: number, candidate: LwinCandidate) => {
    setValidationResults((prev) =>
      prev.map((r) =>
        r.rowIndex === rowIndex
          ? { ...r, status: 'matched' as const, lwin: candidate }
          : r,
      ),
    );
    setSearchingRowIndex(null);
    setLwinSearchQuery('');
    setLwinSearchResults([]);
  };

  // Mark a row as spirit (no LWIN needed)
  const handleMarkAsSpirit = (rowIndex: number) => {
    setValidationResults((prev) =>
      prev.map((r) =>
        r.rowIndex === rowIndex
          ? { ...r, status: 'spirit' as const, lwin: null }
          : r,
      ),
    );
  };

  // Manual LWIN search for a specific row
  const handleLwinSearch = async (query: string) => {
    setLwinSearchQuery(query);
    if (query.length < 2) {
      setLwinSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const result = await trpcClient.lwin.search.query({ query, limit: 5 });
      setLwinSearchResults(
        result.results.map((r) => ({
          lwin: r.lwin,
          displayName: r.displayName,
          producerName: r.producerName,
          country: r.country,
          region: r.region,
          type: r.type,
        })),
      );
    } catch {
      setLwinSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Manually enter an LWIN7 or LWIN18 code for a row
  const handleManualLwin = (rowIndex: number, lwinInput: string) => {
    const cleaned = lwinInput.trim().replace(/[^0-9]/g, '');
    const lwin7 = cleaned.slice(0, 7);

    if (lwin7.length !== 7) return;

    const item = caseItems[rowIndex];
    handleSelectLwin(rowIndex, {
      lwin: lwin7,
      displayName: item?.productName ?? 'Manual LWIN entry',
      producerName: item?.producer || null,
      country: null,
      region: null,
      type: null,
    });
    setManualLwinRowIndex(null);
    setManualLwinValue('');
  };

  const selectedOwnerName = partnersData?.find((p) => p.id === selectedOwnerId)?.name ?? '';

  // Validation summary counts
  const matchedCount = validationResults.filter((r) => r.status === 'matched').length;
  const ambiguousCount = validationResults.filter((r) => r.status === 'ambiguous').length;
  const noMatchCount = validationResults.filter((r) => r.status === 'no_match').length;
  const spiritCount = validationResults.filter((r) => r.status === 'spirit').length;
  const locationErrorCount = validationResults.filter((r) => r.locationValid === false).length;
  const needsAttention = ambiguousCount + noMatchCount + locationErrorCount;

  // Can only import when validated and all issues resolved
  const canImport =
    selectedOwnerId &&
    caseItems.length > 0 &&
    (hasLocationColumn || selectedLocationId) &&
    validationComplete &&
    needsAttention === 0 &&
    !importMutation.isPending;

  const handleImport = () => {
    if (!canImport) return;

    importMutation.mutate({
      ownerId: selectedOwnerId,
      locationId: selectedLocationId || undefined,
      items: caseItems.map((item, i) => {
        const validation = validationResults[i];
        return {
          sku: item.sku || undefined,
          productName: item.productName,
          producer: item.producer || undefined,
          vintage: item.vintage || undefined,
          quantity: item.quantity,
          unit: item.unit,
          bottlesPerCase: item.bottlesPerCase,
          bottleSizeMl: item.bottleSizeMl,
          locationCode: item.locationCode || undefined,
          category: item.category || undefined,
          lwin7: validation?.lwin?.lwin || undefined,
        };
      }),
      notes: `Imported from ${file?.name}`,
    });
  };

  // Status icon for validation results
  const StatusIcon = ({ result }: { result: ValidationResult | undefined }) => {
    if (!result) return null;

    if (result.locationValid === false) {
      return (
        <span title={`Invalid location: ${result.errors.join(', ')}`}>
          <IconMapPin className="h-4 w-4 text-red-500" />
        </span>
      );
    }

    switch (result.status) {
      case 'matched':
        return (
          <span title={`LWIN: ${result.lwin?.lwin} — ${result.lwin?.displayName}`}>
            <IconCircleCheck className="h-4 w-4 text-emerald-500" />
          </span>
        );
      case 'ambiguous':
        return (
          <span title="Multiple LWIN matches — select one">
            <IconAlertTriangle className="h-4 w-4 text-amber-500" />
          </span>
        );
      case 'no_match':
        return (
          <span title="No LWIN match found">
            <IconCircleX className="h-4 w-4 text-red-500" />
          </span>
        );
      case 'spirit':
        return (
          <span title="Spirit/non-wine — SKU identifier">
            <IconBottle className="h-4 w-4 text-blue-500" />
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
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
                  <code className="rounded bg-surface-muted px-1 py-0.5 text-[11px]">category</code>,{' '}
                  <code className="rounded bg-surface-muted px-1 py-0.5 text-[11px]">sku</code>
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

            {/* Step 3: Validate & Review */}
            {caseItems.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <Typography variant="headingSm">
                      3. Validate & Review
                    </Typography>
                    {!validationComplete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleValidate}
                        disabled={isValidating}
                      >
                        <ButtonContent iconLeft={isValidating ? IconLoader2 : IconSearch}>
                          {isValidating ? 'Validating...' : 'Validate Products'}
                        </ButtonContent>
                      </Button>
                    )}
                  </div>

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

                  {/* Validation summary */}
                  {validationComplete && (
                    <div className="mb-4 grid grid-cols-5 gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-2 dark:bg-emerald-900/20">
                        <IconCircleCheck className="h-4 w-4 text-emerald-500" />
                        <div>
                          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{matchedCount}</div>
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Matched</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-2 dark:bg-blue-900/20">
                        <IconBottle className="h-4 w-4 text-blue-500" />
                        <div>
                          <div className="text-sm font-bold text-blue-700 dark:text-blue-300">{spiritCount}</div>
                          <div className="text-[10px] text-blue-600 dark:text-blue-400">Spirits</div>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 ${ambiguousCount > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-fill-secondary'}`}>
                        <IconAlertTriangle className={`h-4 w-4 ${ambiguousCount > 0 ? 'text-amber-500' : 'text-text-muted'}`} />
                        <div>
                          <div className={`text-sm font-bold ${ambiguousCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-text-muted'}`}>{ambiguousCount}</div>
                          <div className={`text-[10px] ${ambiguousCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted'}`}>Ambiguous</div>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 ${noMatchCount > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-fill-secondary'}`}>
                        <IconCircleX className={`h-4 w-4 ${noMatchCount > 0 ? 'text-red-500' : 'text-text-muted'}`} />
                        <div>
                          <div className={`text-sm font-bold ${noMatchCount > 0 ? 'text-red-700 dark:text-red-300' : 'text-text-muted'}`}>{noMatchCount}</div>
                          <div className={`text-[10px] ${noMatchCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-text-muted'}`}>No Match</div>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 ${locationErrorCount > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-fill-secondary'}`}>
                        <IconMapPin className={`h-4 w-4 ${locationErrorCount > 0 ? 'text-red-500' : 'text-text-muted'}`} />
                        <div>
                          <div className={`text-sm font-bold ${locationErrorCount > 0 ? 'text-red-700 dark:text-red-300' : 'text-text-muted'}`}>{locationErrorCount}</div>
                          <div className={`text-[10px] ${locationErrorCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-text-muted'}`}>Bad Loc.</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Owner + location confirmation */}
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
                          .map(([loc, qty]) => {
                            const isInvalid = validationComplete && loc !== 'No location' &&
                              validationResults.some((r) => r.locationValid === false && caseItems[r.rowIndex]?.locationCode === loc);
                            return (
                              <span
                                key={loc}
                                className={`rounded-full px-2 py-0.5 text-xs ${
                                  loc === 'No location' || isInvalid
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                    : 'bg-fill-secondary text-text-primary'
                                }`}
                              >
                                {loc}: {qty} cs
                              </span>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Item preview table with validation */}
                  <div className="mb-4 max-h-[500px] overflow-y-auto rounded border border-border-primary">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-fill-secondary">
                        <tr>
                          {validationComplete && (
                            <th className="w-8 px-2 py-2 text-center text-xs font-medium text-text-muted">ID</th>
                          )}
                          <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">Product</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">Producer</th>
                          <th className="px-2 py-2 text-center text-xs font-medium text-text-muted">Vnt</th>
                          <th className="px-2 py-2 text-center text-xs font-medium text-text-muted">Qty</th>
                          <th className="px-2 py-2 text-center text-xs font-medium text-text-muted">Pack</th>
                          <th className="px-2 py-2 text-center text-xs font-medium text-text-muted">Size</th>
                          <th className="px-2 py-2 text-center text-xs font-medium text-text-muted">Cat</th>
                          {hasLocationColumn && (
                            <th className="px-2 py-2 text-center text-xs font-medium text-text-muted">Loc</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {caseItems.map((item, i) => {
                          const validation = validationComplete ? validationResults[i] : undefined;
                          const needsAction = validation?.status === 'ambiguous' || validation?.status === 'no_match';
                          const isExpanded = searchingRowIndex === i;

                          return (
                            <tr key={i} className="group">
                              <td colSpan={validationComplete ? (hasLocationColumn ? 9 : 8) : (hasLocationColumn ? 8 : 7)} className="p-0">
                                {/* Main row */}
                                <div
                                  className={`flex items-center border-t border-border-primary ${
                                    needsAction ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                                  } ${validation?.locationValid === false ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                                >
                                  <table className="w-full">
                                    <tbody>
                                      <tr>
                                        {validationComplete && (
                                          <td className="w-8 px-2 py-2 text-center">
                                            <StatusIcon result={validation} />
                                          </td>
                                        )}
                                        <td className="px-3 py-2 text-sm">
                                          <div>{item.productName}</div>
                                          {validation?.status === 'matched' && validation.lwin && (
                                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                                              <span>LWIN: {validation.lwin.lwin} — {validation.lwin.displayName}</span>
                                              <button
                                                onClick={() => {
                                                  setSearchingRowIndex(i);
                                                  setLwinSearchQuery(item.productName);
                                                  void handleLwinSearch(item.productName);
                                                }}
                                                className="rounded px-1 py-0.5 text-[10px] text-text-muted hover:bg-fill-secondary hover:text-text-primary"
                                              >
                                                edit
                                              </button>
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-text-muted">{item.producer || '—'}</td>
                                        <td className="px-2 py-2 text-center tabular-nums text-sm text-text-muted">{item.vintage || '—'}</td>
                                        <td className="px-2 py-2 text-center tabular-nums text-sm font-medium">{item.quantity}</td>
                                        <td className="px-2 py-2 text-center tabular-nums text-sm text-text-muted">{item.bottlesPerCase}</td>
                                        <td className="px-2 py-2 text-center tabular-nums text-sm text-text-muted">{item.bottleSizeMl / 10}cl</td>
                                        <td className="px-2 py-2 text-center text-xs text-text-muted">{item.category || '—'}</td>
                                        {hasLocationColumn && (
                                          <td className={`px-2 py-2 text-center font-mono text-xs ${validation?.locationValid === false ? 'text-red-600 font-medium' : ''}`}>
                                            {item.locationCode || (
                                              <span className="text-text-muted">default</span>
                                            )}
                                          </td>
                                        )}
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>

                                {/* Action row for ambiguous/no_match/editing matched */}
                                {(needsAction || isExpanded || manualLwinRowIndex === i) && (
                                  <div className="border-t border-dashed border-amber-300 bg-amber-50/80 px-4 py-2 dark:border-amber-700 dark:bg-amber-900/20">
                                    {validation?.status === 'ambiguous' && validation.candidates.length > 0 && !isExpanded && (
                                      <div className="space-y-1">
                                        <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                          Select LWIN match:
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {validation.candidates.map((c) => (
                                            <button
                                              key={c.lwin}
                                              onClick={() => handleSelectLwin(i, c)}
                                              className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs transition-colors hover:border-emerald-400 hover:bg-emerald-50 dark:border-amber-600 dark:bg-amber-900/30 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/30"
                                            >
                                              <span className="font-mono text-[10px] text-text-muted">{c.lwin}</span>{' '}
                                              <span>{c.displayName}</span>
                                              {c.country && <span className="text-text-muted"> ({c.country})</span>}
                                            </button>
                                          ))}
                                          <button
                                            onClick={() => {
                                              setSearchingRowIndex(i);
                                              setLwinSearchQuery('');
                                              setLwinSearchResults([]);
                                            }}
                                            className="rounded-md border border-border-primary bg-white px-2 py-1 text-xs text-text-muted hover:bg-fill-secondary dark:bg-transparent"
                                          >
                                            Search...
                                          </button>
                                          <button
                                            onClick={() => {
                                              setManualLwinRowIndex(i);
                                              setManualLwinValue('');
                                            }}
                                            className="rounded-md border border-border-primary bg-white px-2 py-1 text-xs text-text-muted hover:bg-fill-secondary dark:bg-transparent"
                                          >
                                            Enter LWIN
                                          </button>
                                          <button
                                            onClick={() => handleMarkAsSpirit(i)}
                                            className="rounded-md border border-blue-300 bg-white px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:border-blue-600 dark:bg-transparent dark:hover:bg-blue-900/30"
                                          >
                                            Not a wine
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {validation?.status === 'no_match' && !isExpanded && manualLwinRowIndex !== i && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-red-600 dark:text-red-400">
                                          No LWIN match found.
                                        </span>
                                        <button
                                          onClick={() => {
                                            setSearchingRowIndex(i);
                                            setLwinSearchQuery(item.productName);
                                            void handleLwinSearch(item.productName);
                                          }}
                                          className="rounded-md border border-border-primary bg-white px-2 py-1 text-xs hover:bg-fill-secondary dark:bg-transparent"
                                        >
                                          Search LWIN
                                        </button>
                                        <button
                                          onClick={() => {
                                            setManualLwinRowIndex(i);
                                            setManualLwinValue('');
                                          }}
                                          className="rounded-md border border-border-primary bg-white px-2 py-1 text-xs hover:bg-fill-secondary dark:bg-transparent"
                                        >
                                          Enter LWIN
                                        </button>
                                        <button
                                          onClick={() => handleMarkAsSpirit(i)}
                                          className="rounded-md border border-blue-300 bg-white px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:border-blue-600 dark:bg-transparent dark:hover:bg-blue-900/30"
                                        >
                                          Not a wine
                                        </button>
                                      </div>
                                    )}

                                    {/* Manual LWIN entry */}
                                    {manualLwinRowIndex === i && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-text-muted">LWIN:</span>
                                        <input
                                          type="text"
                                          value={manualLwinValue}
                                          onChange={(e) => setManualLwinValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleManualLwin(i, manualLwinValue);
                                            if (e.key === 'Escape') { setManualLwinRowIndex(null); setManualLwinValue(''); }
                                          }}
                                          placeholder="e.g. 1870592 or full LWIN18"
                                          className="w-56 rounded-md border border-border-primary bg-white px-2.5 py-1.5 font-mono text-xs focus:border-border-brand focus:outline-none dark:bg-transparent"
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => handleManualLwin(i, manualLwinValue)}
                                          disabled={manualLwinValue.replace(/[^0-9]/g, '').length < 7}
                                          className="rounded-md border border-emerald-400 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
                                        >
                                          Apply
                                        </button>
                                        <button
                                          onClick={() => { setManualLwinRowIndex(null); setManualLwinValue(''); }}
                                          className="text-xs text-text-muted hover:text-text-primary"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    )}

                                    {/* Inline LWIN search */}
                                    {isExpanded && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            value={lwinSearchQuery}
                                            onChange={(e) => handleLwinSearch(e.target.value)}
                                            placeholder="Search LWIN database..."
                                            className="flex-1 rounded-md border border-border-primary bg-white px-2.5 py-1.5 text-xs focus:border-border-brand focus:outline-none dark:bg-transparent"
                                            autoFocus
                                          />
                                          <button
                                            onClick={() => {
                                              setSearchingRowIndex(null);
                                              setLwinSearchQuery('');
                                              setLwinSearchResults([]);
                                            }}
                                            className="text-xs text-text-muted hover:text-text-primary"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                        {isSearching && (
                                          <div className="flex items-center gap-1 text-xs text-text-muted">
                                            <IconLoader2 className="h-3 w-3 animate-spin" /> Searching...
                                          </div>
                                        )}
                                        {lwinSearchResults.length > 0 && (
                                          <div className="flex flex-wrap gap-1.5">
                                            {lwinSearchResults.map((c) => (
                                              <button
                                                key={c.lwin}
                                                onClick={() => handleSelectLwin(i, c)}
                                                className="rounded-md border border-border-primary bg-white px-2 py-1 text-xs transition-colors hover:border-emerald-400 hover:bg-emerald-50 dark:bg-transparent dark:hover:border-emerald-500 dark:hover:bg-emerald-900/30"
                                              >
                                                <span className="font-mono text-[10px] text-text-muted">{c.lwin}</span>{' '}
                                                <span>{c.displayName}</span>
                                                {c.country && <span className="text-text-muted"> ({c.country})</span>}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        {lwinSearchQuery.length >= 2 && !isSearching && lwinSearchResults.length === 0 && (
                                          <div className="text-xs text-text-muted">No results. Try a different search term.</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Needs attention banner */}
                  {validationComplete && needsAttention > 0 && (
                    <div className="mb-3 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                      <IconAlertTriangle className="h-3.5 w-3.5" />
                      {needsAttention} item{needsAttention > 1 ? 's' : ''} need attention before importing
                    </div>
                  )}

                  {/* Not yet validated prompt */}
                  {!validationComplete && !isValidating && (
                    <div className="mb-3 flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                      <IconSearch className="h-3.5 w-3.5" />
                      Click &quot;Validate Products&quot; to match wines against the LWIN database before importing
                    </div>
                  )}

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
