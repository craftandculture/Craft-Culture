import * as XLSX from 'xlsx';

export interface StockExportProduct {
  lwin18: string;
  productName: string;
  producer: string | null;
  vintage: string | null;
  bottleSize: string | null;
  caseConfig: number | null;
  totalCases: number;
  availableCases: number;
  reservedCases: number;
  totalBottles: number;
  locationCount: number;
  ownerCount: number;
  expiryStatus: string;
}

interface ExportStockOptions {
  /** Map of lwin18 → import price per bottle (USD) */
  priceMap?: Record<string, { importPricePerBottle: number } | undefined>;
  /** Label woven into the filename + title row (e.g. owner or filter summary) */
  label?: string;
}

const HEADERS = [
  'Product Name',
  'Producer',
  'LWIN18',
  'Vintage',
  'Size',
  'Pack',
  'Total Cases',
  'Available',
  'Reserved',
  'Import $/btl',
  'Import $/case',
  'Bottles',
  'Locations',
  'Owners',
  'Status',
];

const COL_WIDTHS = [
  { wch: 44 }, { wch: 24 }, { wch: 20 }, { wch: 8 }, { wch: 7 }, { wch: 6 },
  { wch: 11 }, { wch: 10 }, { wch: 9 }, { wch: 12 }, { wch: 13 },
  { wch: 9 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
];

/**
 * Derive the explorer's Status label from expiry status and availability.
 * Mirrors the StatusIndicator badge priority: expired > expiring > stock level.
 */
const statusLabel = (expiryStatus: string, availableCases: number) => {
  if (expiryStatus === 'expired') return 'Expired';
  if (expiryStatus === 'warning') return 'Expiring';
  if (availableCases === 0) return 'Out';
  if (availableCases === 1) return 'Final';
  if (availableCases <= 2) return 'Low';
  return 'Good';
};

/**
 * Export Stock Explorer rows to an Excel workbook matching the on-screen table,
 * with a trailing totals row. Triggers a browser download.
 *
 * @example
 *   exportStockToExcel(products, { priceMap, label: 'RareWine Trading ApS' });
 *
 * @param products - Grouped product rows as returned by stock.getByProduct
 * @param options - Optional import-price map and filename/title label
 */
const exportStockToExcel = (
  products: StockExportProduct[],
  options: ExportStockOptions = {},
) => {
  const { priceMap = {}, label } = options;

  const rows = products.map((p) => {
    const pack = p.caseConfig ?? 12;
    const price = priceMap[p.lwin18]?.importPricePerBottle ?? null;
    return [
      p.productName,
      p.producer ?? '',
      p.lwin18,
      p.vintage ?? '',
      p.bottleSize ?? '75cl',
      p.caseConfig ?? 12,
      p.totalCases,
      p.availableCases,
      p.reservedCases,
      price != null ? Number(price.toFixed(2)) : '',
      price != null ? Number((price * pack).toFixed(2)) : '',
      p.totalBottles,
      p.locationCount,
      p.ownerCount,
      statusLabel(p.expiryStatus, p.availableCases),
    ];
  });

  const totals = products.reduce(
    (acc, p) => ({
      cases: acc.cases + p.totalCases,
      available: acc.available + p.availableCases,
      reserved: acc.reserved + p.reservedCases,
      bottles: acc.bottles + p.totalBottles,
    }),
    { cases: 0, available: 0, reserved: 0, bottles: 0 },
  );

  const totalRow = [
    `TOTAL — ${products.length} product${products.length !== 1 ? 's' : ''}`,
    '', '', '', '', '',
    totals.cases,
    totals.available,
    totals.reserved,
    '', '',
    totals.bottles,
    '', '', '',
  ];

  const aoa: (string | number)[][] = [HEADERS, ...rows, [], totalRow];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = COL_WIDTHS;
  ws['!autofilter'] = { ref: `A1:O${rows.length + 1}` };
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stock Explorer');

  const timestamp = new Date().toISOString().split('T')[0];
  const safeLabel = label ? `-${label.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}` : '';
  XLSX.writeFile(wb, `stock-explorer${safeLabel}-${timestamp}.xlsx`);
};

export default exportStockToExcel;
