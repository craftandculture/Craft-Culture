'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';

import matchSheetLines from '@/app/_winelabs/actions/matchSheetLines';
import type { SheetLine, SheetLineMatch } from '@/app/_winelabs/actions/matchSheetLines';

type Cell = string | number | boolean | null;

interface Sheet {
  fileName: string;
  sheetName: string;
  rows: Cell[][];
  headerRow: number;
}

interface Columns {
  wine: number;
  producer: number;
  vintage: number;
  pack: number;
}

/** Lines sent per call (the action takes up to 12) */
const CHUNK = 12;
const CREDITS_PER_LINE = 8;

const STATUS_LABEL: Record<SheetLineMatch['status'], string> = {
  winelabs: 'Matched by Wine Labs',
  register: 'Matched by register',
  check: 'Check suggestion',
  none: 'Not found',
};

const ADDED = [
  'LWIN7',
  'LWIN11',
  'LWIN18',
  'Matched wine',
  'Producer',
  'Region',
  'Country',
  'Match',
  'Suggested LWIN7',
  'Suggested wine',
];

const text = (cell: Cell | undefined) => (cell === null || cell === undefined ? '' : String(cell).trim());

/** The first of the opening rows that reads as a header: two or more text cells */
const findHeaderRow = (rows: Cell[][]) => {
  const index = rows
    .slice(0, 15)
    .findIndex((row) => row.filter((cell) => typeof cell === 'string' && cell.trim() && !/^\d+$/.test(cell)).length >= 2);
  return Math.max(0, index);
};

/** The column whose header matches, or -1 */
const guess = (header: Cell[], pattern: RegExp, not: number[] = []) =>
  header.findIndex((cell, i) => !not.includes(i) && pattern.test(text(cell)));

const guessColumns = (header: Cell[]): Columns => {
  const wine = Math.max(0, guess(header, /wine|description|product|item|name/i));
  const producer = guess(header, /producer|domaine|ch[aâ]teau|house|estate|brand/i, [wine]);
  const vintage = guess(header, /vintage|year|^vin$/i, [wine]);
  const pack = guess(header, /pack|format|size|case|unit|btl/i, [wine]);
  return { wine, producer, vintage, pack };
};

/** "6x75cl", "12 x 750ml", "6/75", "1x150cl", or a bare "6" */
const readPack = (value: string) => {
  const both = /(\d+)\s*[x×/]\s*(\d+(?:[.,]\d+)?)\s*(cl|ml|l|ltr)?/i.exec(value);
  if (both) {
    const amount = Number(both[2]!.replace(',', '.'));
    const unit = (both[3] ?? '').toLowerCase();
    const ml = unit === 'ml' ? amount : unit.startsWith('l') ? amount * 1000 : amount < 10 ? amount * 1000 : amount * 10;
    return { pack: Number(both[1]), sizeMl: Math.round(ml) };
  }
  const bare = /^\s*(\d{1,2})\s*$/.exec(value);
  return { pack: bare ? Number(bare[1]) : null, sizeMl: null };
};

/** The LWIN11 and LWIN18 a match makes, as far as the sheet says the vintage, pack and size */
const codesFor = (match: SheetLineMatch, name: string, vintageCell: string, packCell: string) => {
  if (!match.lwin7) return { lwin11: '', lwin18: '' };
  const nonVintage = /\bN\.?V\.?\b|non[- ]?vintage/i.test(`${name} ${vintageCell}`);
  const vintage = match.vintage ? String(match.vintage) : nonVintage ? '1000' : null;
  if (!vintage) return { lwin11: '', lwin18: '' };
  const { pack, sizeMl } = readPack(packCell);
  // A pack with no size stated is taken as 75cl, the size nearly every list means
  const size = sizeMl ?? match.bottleSizeMl ?? (pack ? 750 : null);
  return {
    lwin11: `${match.lwin7}${vintage}`,
    lwin18: pack && size ? `${match.lwin7}-${vintage}-${String(pack).padStart(2, '0')}-${String(size).padStart(5, '0')}` : '',
  };
};

const keyOf = (line: SheetLine) => `${line.name}|${line.producer ?? ''}|${line.vintage ?? ''}`.toLowerCase();

/**
 * Upload a spreadsheet of wines and download it again with LWIN codes added
 *
 * The sheet is read in the browser; only the wine, producer and vintage of
 * each distinct line go to the server, a few at a time, to be matched by Wine
 * Labs with our register behind it. The download is the same sheet with ten
 * columns added on the right.
 */
const LwinSheetMatcher = ({ disabled }: { disabled: boolean }) => {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [columns, setColumns] = useState<Columns | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<Map<string, SheetLineMatch> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);

  const header = sheet ? (sheet.rows[sheet.headerRow] ?? []) : [];
  const body = sheet ? sheet.rows.slice(sheet.headerRow + 1) : [];

  const lineOf = (row: Cell[]): SheetLine | null => {
    if (!columns) return null;
    const name = text(row[columns.wine]);
    if (name.length < 3) return null;
    return {
      name,
      producer: columns.producer >= 0 ? text(row[columns.producer]) || null : null,
      vintage: columns.vintage >= 0 ? text(row[columns.vintage]) || null : null,
    };
  };

  const distinct = new Map<string, SheetLine>();
  for (const row of body) {
    const line = lineOf(row);
    if (line) distinct.set(keyOf(line), line);
  }

  const onFile = async (file: File) => {
    setError(null);
    setResults(null);
    setProgress(null);
    const workbook = XLSX.read(await file.arrayBuffer());
    // The first sheet with anything in it
    const sheetName =
      workbook.SheetNames.find((name) => (XLSX.utils.sheet_to_json(workbook.Sheets[name]!, { header: 1 }) as Cell[][]).length > 1) ??
      workbook.SheetNames[0]!;
    const rows = XLSX.utils.sheet_to_json<Cell[]>(workbook.Sheets[sheetName]!, { header: 1, defval: null, raw: true });
    const headerRow = findHeaderRow(rows);
    setSheet({ fileName: file.name, sheetName, rows, headerRow });
    setColumns(guessColumns(rows[headerRow] ?? []));
  };

  const run = async () => {
    cancelled.current = false;
    setBusy(true);
    setError(null);
    const lines = [...distinct.values()];
    const found = new Map(results ?? []);
    const todo = lines.filter((line) => !found.has(keyOf(line)));
    setProgress({ done: lines.length - todo.length, total: lines.length });

    for (let i = 0; i < todo.length; i += CHUNK) {
      if (cancelled.current) break;
      const chunk = todo.slice(i, i + CHUNK);
      try {
        const answer = await matchSheetLines(chunk);
        answer.matches.forEach((match, j) => found.set(keyOf(chunk[j]!), match));
        setResults(new Map(found));
        setProgress({ done: lines.length - todo.length + i + answer.matches.length, total: lines.length });
        if (answer.error) {
          setError(answer.error);
          break;
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'The server did not answer');
        break;
      }
    }
    setBusy(false);
  };

  const download = () => {
    if (!sheet || !columns || !results) return;
    const width = Math.max(...sheet.rows.map((row) => row.length));
    const pad = (row: Cell[]) => [...row, ...Array<Cell>(width - row.length).fill(null)];
    const out = sheet.rows.map((row, index) => {
      if (index < sheet.headerRow) return row;
      if (index === sheet.headerRow) return [...pad(row), ...ADDED];
      const line = lineOf(row);
      const match = line ? results.get(keyOf(line)) : undefined;
      if (!line || !match) return pad(row);
      const { lwin11, lwin18 } = codesFor(
        match,
        line.name,
        line.vintage ?? '',
        columns.pack >= 0 ? text(row[columns.pack]) : '',
      );
      return [
        ...pad(row),
        match.lwin7 ?? '',
        lwin11,
        lwin18,
        match.wine ?? '',
        match.producer ?? '',
        match.region ?? '',
        match.country ?? '',
        STATUS_LABEL[match.status],
        match.suggestion?.lwin7 ?? '',
        match.suggestion?.name ?? '',
      ];
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(out), sheet.sheetName.slice(0, 31));
    XLSX.writeFile(workbook, `${sheet.fileName.replace(/\.[^.]+$/, '')} - LWIN.xlsx`);
  };

  const counts = { winelabs: 0, register: 0, check: 0, none: 0 };
  for (const match of results?.values() ?? []) counts[match.status] += 1;
  const running = busy;
  const columnSelect = (label: string, field: keyof Columns, optional: boolean) => (
    <label className="flex flex-col gap-1 text-xs text-text-muted">
      {label}
      <select
        value={columns?.[field] ?? -1}
        onChange={(event) => {
          setColumns((last) => (last ? { ...last, [field]: Number(event.target.value) } : last));
          setResults(null);
          setProgress(null);
        }}
        className="w-48 rounded-md border border-border-muted bg-background-primary px-2 py-1.5 text-sm text-text-primary"
      >
        {optional && <option value={-1}>None</option>}
        {header.map((cell, i) => (
          <option key={i} value={i}>
            {text(cell) || `Column ${XLSX.utils.encode_col(i)}`}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-2 rounded-xl border border-dashed border-border-muted bg-fill-primary p-6 text-sm">
        <span className="font-medium">{sheet ? sheet.fileName : 'Choose an Excel or CSV file'}</span>
        <span className="text-xs text-text-muted">
          {sheet
            ? `Sheet "${sheet.sheetName}", ${body.length} rows under the header on row ${sheet.headerRow + 1}`
            : 'One wine per row. A producer, vintage or pack column helps, but the wine name alone is enough.'}
        </span>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={running}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
          }}
          className="text-xs"
        />
      </label>

      {sheet && columns && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border-muted bg-fill-primary p-3">
          {columnSelect('Wine', 'wine', false)}
          {columnSelect('Producer', 'producer', true)}
          {columnSelect('Vintage', 'vintage', true)}
          {columnSelect('Pack / size (for LWIN18)', 'pack', true)}
          {running ? (
            <button
              type="button"
              onClick={() => {
                cancelled.current = true;
              }}
              className="rounded-md border border-border-muted px-3 py-1.5 text-sm font-medium"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled || distinct.size === 0}
              onClick={() => void run()}
              className="rounded-md bg-text-primary px-3 py-1.5 text-sm font-medium text-background-primary hover:opacity-90 disabled:opacity-50"
            >
              {results && results.size > 0 && results.size < distinct.size ? 'Continue matching' : 'Find LWINs'}
            </button>
          )}
          <span className="text-xs text-text-muted">
            {distinct.size} distinct wines · about {(distinct.size * CREDITS_PER_LINE).toLocaleString('en-US')}{' '}
            credits
          </span>
        </div>
      )}

      {progress && (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-fill-muted">
            <div
              className="h-full bg-text-primary transition-all"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-sm text-text-muted">
            {progress.done} of {progress.total} wines · {counts.winelabs} by Wine Labs · {counts.register} by our
            register · {counts.check} to check · {counts.none} not found
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-700 dark:text-red-300">Stopped: {error}</p>}

      {results && results.size > 0 && !running && (
        <button
          type="button"
          onClick={download}
          className="rounded-md bg-text-primary px-3 py-1.5 text-sm font-medium text-background-primary hover:opacity-90"
        >
          Download with LWINs
        </button>
      )}
    </div>
  );
};

export default LwinSheetMatcher;
