'use client';

import { IconFileSpreadsheet, IconUpload } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

import extractVintageFromName from '@/app/_pricingCalculator/utils/extractVintageFromName';
import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

interface ParsedRow {
  productName: string;
  vintage?: string;
  country?: string;
  region?: string;
  bottleSize?: string;
  sellingPriceAed?: number;
  sellingPriceUsd?: number;
  quantity?: number;
}

/**
 * Competitor wine list upload - parse CSV/Excel client-side and upload structured data
 */
const UPLOAD_CHUNK_SIZE = 500;

const CompetitorUpload = () => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [competitorName, setCompetitorName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    matched: number;
    unmatched: number;
  } | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    matched: number;
    unmatched: number;
  } | null>(null);
  const [uploadError, setUploadError] = useState('');

  // Fetch existing competitor wines (enough to summarize by competitor)
  const { data: existingWines, refetch: refetchWines } = useQuery({
    ...api.agents.getCompetitorWines.queryOptions({ limit: 500 }),
  });

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setParseError('');
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]!];
          if (!firstSheet) {
            setParseError('No data found in spreadsheet');
            return;
          }

          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

          // Normalize row keys — Excel headers may contain \r\n line breaks
          const normalizedJson = json.map((row) => {
            const normalized: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(row)) {
              normalized[key.replace(/[\r\n]+/g, ' ').trim()] = value;
            }
            return normalized;
          });

          // Map columns — handle common header variations
          const rows: ParsedRow[] = [];

          for (const row of normalizedJson) {
            const get = (keys: string[]) => {
              for (const key of keys) {
                const val = row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];
                if (val !== undefined && val !== null && val !== '') return String(val);
              }
              return undefined;
            };

            const getNum = (keys: string[]) => {
              const val = get(keys);
              if (!val) return undefined;
              const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
              return isNaN(num) ? undefined : num;
            };

            const rawProductName =
              get([
                'Product Name',
                'Wine',
                'Name',
                'Product',
                'Description',
                'Item',
                'Wine Name',
                'Château / Estate / Brand',
                'Chateau / Estate / Brand',
                'Château / Estate / Brand_1',
                'Chateau',
                'Estate',
                'Brand',
              ]) ?? '';

            if (!rawProductName) continue;

            // Skip section header rows (e.g. "CHAMPAGNE", "St Estephe") that have
            // a name but no price, vintage, country, or product code
            const hasPrice = getNum([
              'Price AED', 'AED', 'Selling Price AED', 'Price (AED)',
              'Selling Price Bottle', 'Selling Price', 'Price', 'Unit Price',
              'Al Hamra AED Price incl VAT', 'Al Hamra AED Price ex VAT',
              'AED Price incl VAT', 'AED Price ex VAT',
              'Price USD', 'USD',
            ]);
            const hasVintage = get(['Vintage', 'Year', 'Yr']);
            const hasCountry = get(['Country', 'Origin']);
            const hasProductCode = get(['Product Code', 'SKU', 'Code', 'Item Code']);

            if (!hasPrice && !hasVintage && !hasCountry && !hasProductCode) continue;

            // Extract vintage from wine name if no dedicated Vintage column
            let vintage = hasVintage;
            let cleanedProductName = rawProductName;

            if (!vintage) {
              const extracted = extractVintageFromName(rawProductName);
              if (extracted.vintage) {
                vintage = extracted.vintage;
                cleanedProductName = extracted.cleanedName;
              }
            }

            // Extract bottle size from wine name if no dedicated Size column
            let bottleSize = get([
              'Size',
              'Bottle Size',
              'BottleSize',
              'Format',
              'Format CL',
              'Volume',
            ]);

            if (!bottleSize) {
              const sizeMatch = rawProductName.match(
                /\b(\d+x)?(\d+(?:\.\d+)?)\s*(cl|ml|l|ltr)\b/i,
              );
              if (sizeMatch) {
                bottleSize = sizeMatch[0];
                cleanedProductName = cleanedProductName
                  .replace(sizeMatch[0], '')
                  .replace(/\s+/g, ' ')
                  .trim();
              }
            }

            rows.push({
              productName: cleanedProductName,
              vintage,
              country: get(['Country', 'Origin']),
              region: get(['Region', 'Appellation', 'Area']),
              bottleSize,
              sellingPriceAed: getNum([
                'Price AED',
                'AED',
                'Selling Price AED',
                'Price (AED)',
                'Selling Price Bottle',
                'Selling Price',
                'Price',
                'Unit Price',
                'Al Hamra AED Price incl VAT',
                'Al Hamra AED Price ex VAT',
                'AED Price incl VAT',
                'AED Price ex VAT',
              ]),
              sellingPriceUsd: getNum(['Price USD', 'USD']),
              quantity: getNum([
                'Qty',
                'Quantity',
                'Stock',
                'Available',
                'Bottle volume available',
                'Volume Available',
                'RAK shop stocks',
              ]),
            });
          }

          if (rows.length === 0) {
            setParseError(
              'No wine rows detected. Ensure the file has a "Product Name" or "Wine" column.',
            );
            return;
          }

          setParsedRows(rows);
        } catch (err) {
          setParseError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      };

      reader.readAsArrayBuffer(file);
    },
    [],
  );

  const handleUpload = async () => {
    if (!competitorName.trim() || parsedRows.length === 0) return;

    const chunks: ParsedRow[][] = [];
    for (let i = 0; i < parsedRows.length; i += UPLOAD_CHUNK_SIZE) {
      chunks.push(parsedRows.slice(i, i + UPLOAD_CHUNK_SIZE));
    }

    setUploadError('');
    setUploadResult(null);
    setUploadProgress({ current: 0, total: parsedRows.length, matched: 0, unmatched: 0 });

    let totalMatched = 0;
    let totalUnmatched = 0;

    try {
      for (let i = 0; i < chunks.length; i++) {
        const result = await trpcClient.agents.uploadCompetitorList.mutate({
          competitorName: competitorName.trim(),
          source: fileName,
          rows: chunks[i]!,
          appendMode: i > 0,
        });

        totalMatched += result.matched;
        totalUnmatched += result.unmatched;

        setUploadProgress({
          current: Math.min((i + 1) * UPLOAD_CHUNK_SIZE, parsedRows.length),
          total: parsedRows.length,
          matched: totalMatched,
          unmatched: totalUnmatched,
        });
      }

      setUploadResult({ matched: totalMatched, unmatched: totalUnmatched });
      setUploadProgress(null);
      setParsedRows([]);
      setFileName('');
      setCompetitorName('');
      void refetchWines();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      setUploadProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      <Typography variant="headingSm">Upload Competitor Wine List</Typography>
      <Typography variant="bodySm" colorRole="muted">
        Upload a CSV or Excel file with competitor pricing. The Scout agent will use this data for
        daily competitive analysis.
      </Typography>

      <Card>
        <CardContent className="space-y-4 p-6">
          {/* Competitor name */}
          <div>
            <label className="mb-1 block text-sm font-medium">Competitor Name</label>
            <input
              type="text"
              value={competitorName}
              onChange={(e) => setCompetitorName(e.target.value)}
              placeholder="e.g. JY Wine, MMI, A&E"
              className="w-full rounded-md border border-border-muted bg-background-primary px-3 py-2 text-sm focus:border-border-brand focus:outline-none"
            />
          </div>

          {/* File input */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <IconFileSpreadsheet size={16} className="mr-2" />
              {fileName || 'Select CSV or Excel file'}
            </Button>
          </div>

          {parseError && (
            <Typography variant="bodyXs" className="text-red-600">
              {parseError}
            </Typography>
          )}

          {/* Preview */}
          {parsedRows.length > 0 && (
            <div>
              <Typography variant="bodySm" className="mb-2 font-medium">
                Preview ({parsedRows.length} wines detected)
              </Typography>
              <div className="max-h-60 overflow-auto rounded-md border border-border-muted">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface-secondary">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Wine</th>
                      <th className="px-2 py-1.5 text-left">Vintage</th>
                      <th className="px-2 py-1.5 text-left">Size</th>
                      <th className="px-2 py-1.5 text-left">Country</th>
                      <th className="px-2 py-1.5 text-right">Qty</th>
                      <th className="px-2 py-1.5 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t border-border-muted">
                        <td className="max-w-[200px] truncate px-2 py-1.5">{row.productName}</td>
                        <td className="px-2 py-1.5">{row.vintage ?? '-'}</td>
                        <td className="px-2 py-1.5">{row.bottleSize ?? '-'}</td>
                        <td className="px-2 py-1.5">{row.country ?? '-'}</td>
                        <td className="px-2 py-1.5 text-right">{row.quantity ?? '-'}</td>
                        <td className="px-2 py-1.5 text-right">
                          {row.sellingPriceAed
                            ? `${row.sellingPriceAed.toFixed(0)} AED`
                            : row.sellingPriceUsd
                              ? `${row.sellingPriceUsd.toFixed(0)} USD`
                              : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 20 && (
                  <div className="border-t border-border-muted p-2 text-center text-xs text-text-muted">
                    ... and {parsedRows.length - 20} more rows
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload button */}
          <Button
            onClick={handleUpload}
            disabled={!competitorName.trim() || parsedRows.length === 0 || !!uploadProgress}
            className="w-full"
          >
            <IconUpload size={16} className="mr-2" />
            {uploadProgress
              ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...`
              : `Upload ${parsedRows.length} wines`}
          </Button>

          {uploadProgress && (
            <div>
              <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
                <div
                  className="h-full rounded-full bg-fill-brand transition-all"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
              <Typography variant="bodyXs" colorRole="muted">
                {uploadProgress.matched} matched, {uploadProgress.unmatched} unmatched so far
              </Typography>
            </div>
          )}

          {uploadResult && (
            <Typography variant="bodySm" className="text-green-600">
              Uploaded successfully! {uploadResult.matched} wines matched to LWIN database,{' '}
              {uploadResult.unmatched} unmatched.
            </Typography>
          )}

          {uploadError && (
            <Typography variant="bodySm" className="text-red-600">
              Upload failed: {uploadError}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Existing competitor wines summary */}
      {existingWines && existingWines.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <Typography variant="headingSm" className="mb-2">
              Uploaded Competitor Wines
            </Typography>
            <Typography variant="bodyXs" colorRole="muted" className="mb-3">
              {existingWines.length} active competitor wines in the database
            </Typography>
            <div className="space-y-1">
              {Object.entries(
                existingWines.reduce<Record<string, number>>((acc, w) => {
                  const name = w.competitorName ?? 'Unknown';
                  acc[name] = (acc[name] ?? 0) + 1;
                  return acc;
                }, {}),
              ).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{name}</span>
                  <span className="text-text-muted">{count} wines</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CompetitorUpload;
