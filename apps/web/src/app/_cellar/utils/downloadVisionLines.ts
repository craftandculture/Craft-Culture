import csvCell from './csvCell';

interface VisionMove {
  moveNumber: string;
  items: Array<{
    rotation: string;
    lwin18: string;
    name: string;
    vintage: number | null;
    cases: number;
    singles: number;
  }>;
}

/**
 * Download the lines for LCB's Vision export order, one per LCB line
 *
 * Export (Non EC) under Goods Outwards → Enter Orders: the product code is the
 * dashed LWIN18, picked by rotation, consignee postcode "Export", and the move
 * number as Your Ref so the order and the request can be matched. Used from
 * the moves list and from a shipment's UK cellar wine panel.
 *
 * @param move - The move and its LCB lines
 */
const downloadVisionLines = (move: VisionMove) => {
  const header = [
    'Your Ref',
    'Order Type',
    'Rotation',
    'Product Code',
    'Description',
    'Vintage',
    'Cases',
    'Singles',
    'Consignee',
    'Postcode',
  ];

  const rows = move.items.map((item) => [
    move.moveNumber,
    'Export (Non EC)',
    item.rotation,
    item.lwin18,
    item.name,
    item.vintage ?? 'NV',
    item.cases,
    item.singles,
    'Craft & Culture FZE, United Arab Emirates',
    'Export',
  ]);

  const csv = [header, ...rows].map((row) => row.map((value) => csvCell(value)).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');

  link.href = url;
  link.download = `${move.moveNumber}-lcb-export-order.csv`;
  link.click();
  /* Revoked on the next tick: revoking straight after click can cancel the download in Safari */
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

export default downloadVisionLines;
