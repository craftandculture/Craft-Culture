import * as XLSX from 'xlsx';

export interface InboundExportProduct {
  productName: string;
  producer: string | null;
  lwin: string | null;
  vintage: number | null;
  bottleSizeMl: number | null;
  bottlesPerCase: number | null;
  expectedCases: number;
  expectedBottles: number;
  costPerBottle: number | null;
  earliestEta: Date | string | null;
  shipments: {
    shipmentNumber: string;
    shipmentStatus: string;
    partnerName: string | null;
    cases: number;
    eta: Date | string | null;
    originCountry: string | null;
  }[];
}

const HEADERS = [
  'Product Name',
  'Producer',
  'LWIN18',
  'Vintage',
  'Size',
  'Pack',
  'Expected Cases',
  'Bottles',
  'ETA',
  'Import $/btl',
  'Import $/case',
  'Shipments',
  'Supplier',
  'Origin',
];

const COL_WIDTHS = [
  { wch: 44 }, { wch: 24 }, { wch: 20 }, { wch: 8 }, { wch: 7 }, { wch: 6 },
  { wch: 14 }, { wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 13 },
  { wch: 40 }, { wch: 28 }, { wch: 14 },
];

const toDate = (value: Date | string | null) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : (d.toISOString().split('T')[0] ?? '');
};

const unique = (values: (string | null)[]) =>
  [
    ...new Set(
      values.map((v) => v?.trim() ?? '').filter((v) => v.length > 0),
    ),
  ].join('; ');

/**
 * Export the Stock Explorer's inbound view (wine on active shipments, not yet
 * received) to an Excel workbook, with each shipment named so the sheet can be
 * chased line by line. Triggers a browser download.
 *
 * @example
 *   exportInboundToExcel(products);
 *
 * @param products - Inbound product rows as returned by stock.getInbound
 */
const exportInboundToExcel = (products: InboundExportProduct[]) => {
  const rows = products.map((p) => {
    const pack = p.bottlesPerCase ?? 12;
    const price = p.costPerBottle;
    return [
      p.productName,
      p.producer ?? '',
      p.lwin ?? '',
      p.vintage ?? 'NV',
      p.bottleSizeMl ? `${p.bottleSizeMl / 10}cl` : '75cl',
      pack,
      p.expectedCases,
      p.expectedBottles,
      toDate(p.earliestEta),
      price != null ? Number(price.toFixed(2)) : '',
      price != null ? Number((price * pack).toFixed(2)) : '',
      p.shipments
        .map((s) => `${s.shipmentNumber} (${s.cases} cs, ${s.shipmentStatus.replace(/_/g, ' ')})`)
        .join('; '),
      unique(p.shipments.map((s) => s.partnerName)),
      unique(p.shipments.map((s) => s.originCountry)),
    ];
  });

  const totals = products.reduce(
    (acc, p) => ({
      cases: acc.cases + p.expectedCases,
      bottles: acc.bottles + p.expectedBottles,
    }),
    { cases: 0, bottles: 0 },
  );

  const totalRow = [
    `TOTAL — ${products.length} product${products.length !== 1 ? 's' : ''}`,
    '', '', '', '', '',
    totals.cases,
    totals.bottles,
    '', '', '', '', '', '',
  ];

  const aoa: (string | number)[][] = [HEADERS, ...rows, [], totalRow];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = COL_WIDTHS;
  ws['!autofilter'] = { ref: `A1:N${rows.length + 1}` };
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inbound');

  const timestamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `stock-explorer-inbound-${timestamp}.xlsx`);
};

export default exportInboundToExcel;
