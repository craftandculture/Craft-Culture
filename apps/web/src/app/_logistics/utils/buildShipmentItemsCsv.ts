import neutraliseCsvFormula from '@/utils/neutraliseCsvFormula';

export interface ShipmentItemsCsvRow {
  productName: string;
  vintage?: number | null;
  lwin?: string | null;
  hsCode?: string | null;
  bottlesPerCase?: number | null;
  bottleSizeMl?: number | null;
  cases?: number | null;
  totalBottles?: number | null;
  productCostPerBottle?: number | null;
}

const cell = (value: string | number | null | undefined) => {
  // A product name starting with = + - @ would run as a formula in Excel
  const text = neutraliseCsvFormula(value == null ? '' : String(value));
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * A shipment's lines as CSV, for checking against the supplier invoice
 *
 * Starts with a byte-order mark so Excel reads accented names (Château) as
 * UTF-8 rather than garbling them. Line totals and a totals row are included
 * because an invoice is checked line by line and then at the bottom.
 *
 * @example
 *   buildShipmentItemsCsv(items); // '﻿Product,Vintage,...'
 *
 * @param items - Shipment lines in the order they should appear
 * @returns CSV text ready to download
 */
const buildShipmentItemsCsv = (items: ShipmentItemsCsvRow[]) => {
  const header = [
    'Product',
    'Vintage',
    'LWIN',
    'HS',
    'Pack',
    'Cases',
    'Bottles',
    'Cost/btl',
    'Line total',
  ];

  let cases = 0;
  let bottles = 0;
  let total = 0;

  const lines = items.map((item) => {
    const lineBottles =
      item.totalBottles ?? (item.cases ?? 0) * (item.bottlesPerCase ?? 0);
    const lineTotal =
      item.productCostPerBottle != null
        ? Math.round(item.productCostPerBottle * lineBottles * 100) / 100
        : null;

    cases += item.cases ?? 0;
    bottles += lineBottles;
    total += lineTotal ?? 0;

    const pack = item.bottlesPerCase
      ? `${item.bottlesPerCase} x ${(item.bottleSizeMl ?? 750) / 10}cl`
      : '';

    return [
      item.productName,
      item.vintage,
      item.lwin,
      item.hsCode,
      pack,
      item.cases,
      lineBottles,
      item.productCostPerBottle?.toFixed(2),
      lineTotal?.toFixed(2),
    ];
  });

  const totals = ['Total', '', '', '', '', cases, bottles, '', total.toFixed(2)];

  return (
    '﻿' +
    [header, ...lines, totals].map((row) => row.map(cell).join(',')).join('\n')
  );
};

export default buildShipmentItemsCsv;
