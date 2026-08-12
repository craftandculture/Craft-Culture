'use client';

import { IconFileSpreadsheet, IconLoader2, IconUpload } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import SelectField from './SelectField';
import type {
  ImportLineInput,
  TriAliasSource,
  TriImportKind,
} from '../schemas/triangulationSchemas';
import detectHeaderRow from '../utils/detectHeaderRow';
import fileToBase64 from '../utils/fileToBase64';
import guessColumnMapping from '../utils/guessColumnMapping';
import type { TriColumnField, TriColumnMapping } from '../utils/guessColumnMapping';
import importKindLabels from '../utils/importKindLabels';
import parseCell from '../utils/parseCell';
import parseWorkbook from '../utils/parseWorkbook';
import type { ParsedSheet } from '../utils/parseWorkbook';


export interface ImportWizardProps {
  kind: TriImportKind;
  periodId: string | null;
  defaultAsOfDate: string;
  onClose: () => void;
}

const COLUMN_FIELDS: { field: TriColumnField; label: string; required?: boolean }[] = [
  { field: 'rawCode', label: 'Product code', required: true },
  { field: 'rawDescription', label: 'Description' },
  { field: 'rawVintage', label: 'Vintage' },
  { field: 'quantity', label: 'Quantity', required: true },
  { field: 'caseConfig', label: 'Bottles per case' },
  { field: 'unitPrice', label: 'Unit price' },
  { field: 'currency', label: 'Currency' },
  { field: 'docRef', label: 'Invoice / doc ref' },
  { field: 'docDate', label: 'Document date' },
];

/** File types that go to document extraction rather than the spreadsheet parser */
const DOCUMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const;

const ALIAS_SOURCES: { value: TriAliasSource; label: string }[] = [
  { value: 'city_drinks', label: 'City Drinks (CD codes)' },
  { value: 'crurated', label: 'Owner / internal (W codes)' },
  { value: 'zoho', label: 'Zoho item codes' },
  { value: 'packing_list', label: 'Packing list codes' },
  { value: 'other', label: 'Other' },
];

/** Which code namespace each input normally speaks */
const defaultAliasSource = (kind: TriImportKind): TriAliasSource => {
  if (kind === 'cd_sales' || kind === 'cd_count') {
    return 'city_drinks';
  }

  if (kind === 'cc_sales_to_cd') {
    return 'zoho';
  }

  return 'crurated';
};

/**
 * Upload one monthly input and map its columns onto the triangulation model
 *
 * Every party sends a differently shaped spreadsheet, and those shapes change.
 * Rather than hard-coding column positions, the file is parsed in the browser
 * and the user confirms a pre-filled mapping — which means a changed export
 * costs a dropdown, not a code change.
 */
const ImportWizard = ({
  kind,
  periodId,
  defaultAsOfDate,
  onClose,
}: ImportWizardProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const meta = importKindLabels[kind];

  const [fileName, setFileName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<TriColumnMapping>({});
  const [unit, setUnit] = useState<'bottle' | 'case'>(meta.defaultUnit);
  const [aliasSource, setAliasSource] = useState<TriAliasSource>(
    defaultAliasSource(kind),
  );
  const [asOfDate, setAsOfDate] = useState(defaultAsOfDate);
  const [isParsing, setIsParsing] = useState(false);
  /** Lines read out of a PDF or scan, which bypass sheet and column mapping */
  const [extracted, setExtracted] = useState<ImportLineInput[] | null>(null);
  const [extractionNote, setExtractionNote] = useState<string | null>(null);

  const extractPackingList = useMutation({
    ...api.triangulation.admin.extractPackingList.mutationOptions(),
    onError: (error) => toast.error(error.message),
  });

  const sheet = sheets[sheetIndex];
  const headers = useMemo(() => sheet?.matrix[headerRow] ?? [], [sheet, headerRow]);

  const createImport = useMutation({
    ...api.triangulation.admin.createImport.mutationOptions(),
    onSuccess: async (result) => {
      const unmapped = result.rowCount - result.mappedRowCount;

      toast.success(
        unmapped > 0
          ? `Imported ${result.rowCount} rows — ${unmapped} need a code mapping`
          : `Imported ${result.rowCount} rows, all mapped`,
      );

      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getImports.queryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getUnmapped.queryKey(),
      });

      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setIsParsing(true);

    // Packing lists arrive as PDFs or scans, which have no rows or columns to
    // map — they go to extraction and come back as lines directly.
    const documentType = DOCUMENT_TYPES.find((type) => type === file.type);

    if (documentType) {
      try {
        const result = await extractPackingList.mutateAsync({
          file: await fileToBase64(file),
          mediaType: documentType,
          fileName: file.name,
        });

        setExtracted(
          result.lines.map((line) => ({
            rawCode: line.code ?? null,
            rawDescription: line.productName,
            rawVintage: line.vintage ?? null,
            quantity: line.quantityCases,
            unit: 'case' as const,
            caseConfig: line.caseConfig ?? null,
            unitPrice: null,
            currency: null,
            docRef: result.documentRef ?? null,
            docDate: result.documentDate ?? null,
            raw: null,
          })),
        );
        setExtractionNote(
          [
            result.documentRef ? `Ref ${result.documentRef}` : null,
            result.linesWithoutPack > 0
              ? `${result.linesWithoutPack} lines state no pack size — each SKU's own pack size will be used`
              : null,
            result.linesWithoutCode > 0
              ? `${result.linesWithoutCode} lines have no product code and will need mapping by hand`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || null,
        );

        if (result.documentDate) {
          setAsOfDate(result.documentDate);
        }

        setFileName(file.name);
      } catch {
        // The mutation's onError has already surfaced the reason.
      } finally {
        setIsParsing(false);
      }

      return;
    }

    try {
      const parsed = await parseWorkbook(file);

      if (parsed.length === 0) {
        toast.error('That file has no readable rows');
        return;
      }

      const firstSheet = parsed[0];
      const detected = firstSheet ? detectHeaderRow(firstSheet.matrix) : 0;

      setSheets(parsed);
      setSheetIndex(0);
      setHeaderRow(detected);
      setMapping(guessColumnMapping(firstSheet?.matrix[detected] ?? []));
      setFileName(file.name);
    } catch {
      toast.error('Could not read that file. Excel (.xlsx) and CSV are supported.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSheetChange = (index: number) => {
    const next = sheets[index];
    const detected = next ? detectHeaderRow(next.matrix) : 0;

    setSheetIndex(index);
    setHeaderRow(detected);
    setMapping(guessColumnMapping(next?.matrix[detected] ?? []));
  };

  const handleHeaderRowChange = (index: number) => {
    setHeaderRow(index);
    setMapping(guessColumnMapping(sheet?.matrix[index] ?? []));
  };

  const { lines, skipped } = useMemo(() => {
    if (extracted) {
      return { lines: extracted, skipped: 0 };
    }

    if (!sheet || mapping.quantity === undefined) {
      return { lines: [] as ImportLineInput[], skipped: 0 };
    }

    const built: ImportLineInput[] = [];
    let ignored = 0;

    for (let index = headerRow + 1; index < sheet.matrix.length; index += 1) {
      const row = sheet.matrix[index];

      if (!row) {
        continue;
      }

      const cells = parseCell(row);
      const rawCode = cells.text(mapping.rawCode);
      const rawDescription = cells.text(mapping.rawDescription);
      const quantity = cells.number(mapping.quantity);

      // A row with no identity or no quantity cannot move stock; count it so
      // the preview can say how much of the file was left behind.
      if ((!rawCode && !rawDescription) || quantity === null) {
        ignored += 1;
        continue;
      }

      built.push({
        rawCode,
        rawDescription,
        rawVintage: cells.text(mapping.rawVintage),
        quantity,
        unit,
        caseConfig: cells.number(mapping.caseConfig) ?? null,
        unitPrice: cells.number(mapping.unitPrice),
        currency: cells.text(mapping.currency),
        docRef: cells.text(mapping.docRef),
        docDate: cells.date(mapping.docDate),
        raw: null,
      });
    }

    return { lines: built, skipped: ignored };
  }, [sheet, mapping, headerRow, unit, extracted]);

  const totalBottles = lines.reduce(
    (sum, line) => sum + line.quantity * (unit === 'case' ? (line.caseConfig ?? 6) : 1),
    0,
  );

  // Extracted documents carry their own codes, so there is no mapping to confirm.
  const canSubmit =
    lines.length > 0 &&
    (extracted !== null || mapping.rawCode !== undefined) &&
    !!asOfDate;

  if (!fileName) {
    return (
      <div className="space-y-4">
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p>{meta.description}</p>
        </Typography>
        <label className="border-border-primary hover:bg-fill-muted/30 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center transition-colors">
          {isParsing ? (
            <IconLoader2 className="size-6 animate-spin" />
          ) : (
            <IconUpload className="size-6" />
          )}
          <Typography variant="labelSm">
            {isParsing
              ? extractPackingList.isPending
                ? 'Reading the document — this can take a minute…'
                : 'Reading file…'
              : 'Choose a spreadsheet or a packing list'}
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            .xlsx, .xls or .csv parsed in your browser · .pdf, .png or .jpg read
            by Claude
          </Typography>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <IconFileSpreadsheet className="size-4 shrink-0" />
        <Typography variant="labelSm">{fileName}</Typography>
        <Button
          size="xs"
          variant="ghost"
          colorRole="muted"
          onClick={() => {
            setFileName(null);
            setSheets([]);
            setMapping({});
            setExtracted(null);
            setExtractionNote(null);
          }}
        >
          Change file
        </Button>
      </div>

      {extracted ? (
        <div className="border-border-warning/40 bg-fill-warning/10 rounded-lg border p-3">
          <Typography variant="bodyXs" colorRole="warning" asChild>
            <p>
              Read from the document by Claude — check the rows below against the
              original before importing.
              {extractionNote ? ` ${extractionNote}.` : ''}
            </p>
          </Typography>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {extracted ? null : (
          <>
        <SelectField
          label="Sheet"
          value={sheetIndex}
          onChange={(event) => handleSheetChange(Number(event.target.value))}
        >
          {sheets.map((entry, index) => (
            <option key={entry.name} value={index}>
              {entry.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Header row"
          value={headerRow}
          onChange={(event) => handleHeaderRowChange(Number(event.target.value))}
        >
          {(sheet?.matrix.slice(0, 25) ?? []).map((row, index) => (
            <option key={index} value={index}>
              Row {index + 1}:{' '}
              {row
                .filter((cell) => cell !== null && cell !== undefined)
                .slice(0, 4)
                .map((cell) => String(cell))
                .join(' | ')
                .slice(0, 48)}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Quantities are in"
          value={unit}
          onChange={(event) => setUnit(event.target.value as 'bottle' | 'case')}
        >
          <option value="bottle">Bottles</option>
          <option value="case">Cases</option>
        </SelectField>
          </>
        )}

        <SelectField
          label="Codes in this file are"
          value={aliasSource}
          onChange={(event) => setAliasSource(event.target.value as TriAliasSource)}
        >
          {ALIAS_SOURCES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className={extracted ? 'hidden' : undefined}>
        <Typography variant="labelSm" asChild>
          <p className="mb-2">Column mapping</p>
        </Typography>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COLUMN_FIELDS.map(({ field, label, required }) => (
            <SelectField
              key={field}
              label={required ? `${label} *` : label}
              value={mapping[field] ?? ''}
              onChange={(event) =>
                setMapping((current) => ({
                  ...current,
                  [field]:
                    event.target.value === '' ? undefined : Number(event.target.value),
                }))
              }
            >
              <option value="">— not in file —</option>
              {headers.map((header, index) => (
                <option key={index} value={index}>
                  {typeof header === 'string' && header.trim()
                    ? header
                    : `Column ${index + 1}`}
                </option>
              ))}
            </SelectField>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-xs font-medium tracking-tight">
            {meta.behaviour === 'snapshot' ? 'Count date *' : 'Effective date *'}
          </span>
          <input
            type="date"
            value={asOfDate}
            onChange={(event) => setAsOfDate(event.target.value)}
            className="border-border-primary bg-fill-primary text-text-primary focus:ring-border-primary min-h-9 rounded-lg border border-b-2 px-2.5 text-sm font-medium focus:outline-none focus:ring-2"
          />
        </label>
        <div className="border-border-primary bg-fill-muted/20 rounded-lg border p-3">
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p>
              {meta.behaviour === 'snapshot'
                ? 'The calculated position is re-cut to this date before comparing, so an older count is not blamed for later movements.'
                : 'Rows are counted from this date onwards in every period that ends on or after it.'}
            </p>
          </Typography>
        </div>
      </div>

      <div className="border-border-primary rounded-xl border p-3">
        <Typography variant="labelSm" asChild>
          <p className="mb-2">
            Preview — {lines.length.toLocaleString('en-GB')} rows,{' '}
            {totalBottles.toLocaleString('en-GB')} bottles
            {skipped > 0 ? `, ${skipped.toLocaleString('en-GB')} skipped` : ''}
          </p>
        </Typography>
        {lines.length === 0 ? (
          <Typography variant="bodySm" colorRole="danger">
            No usable rows. Check the header row and that a quantity column is
            mapped.
          </Typography>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-text-muted">
                <tr>
                  <th className="py-1 pr-3">Code</th>
                  <th className="py-1 pr-3">Description</th>
                  <th className="py-1 pr-3">Vintage</th>
                  <th className="py-1 pr-3 text-right">Qty</th>
                  <th className="py-1 pr-3">Doc ref</th>
                  <th className="py-1">Doc date</th>
                </tr>
              </thead>
              <tbody>
                {lines.slice(0, 6).map((line, index) => (
                  <tr key={index} className="border-border-primary border-t">
                    <td className="py-1 pr-3 font-mono">{line.rawCode ?? '—'}</td>
                    <td className="py-1 pr-3">{line.rawDescription ?? '—'}</td>
                    <td className="py-1 pr-3">{line.rawVintage ?? '—'}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">
                      {line.quantity} {unit === 'case' ? 'cs' : 'btl'}
                    </td>
                    <td className="py-1 pr-3">{line.docRef ?? '—'}</td>
                    <td className="py-1">{line.docDate ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button colorRole="muted" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          colorRole="brand"
          isDisabled={!canSubmit || createImport.isPending}
          onClick={() =>
            createImport.mutate({
              periodId,
              kind,
              fileName,
              asOfDate,
              aliasSource,
              lines,
            })
          }
        >
          {createImport.isPending ? 'Importing…' : `Import ${lines.length} rows`}
        </Button>
      </div>
    </div>
  );
};

export default ImportWizard;
