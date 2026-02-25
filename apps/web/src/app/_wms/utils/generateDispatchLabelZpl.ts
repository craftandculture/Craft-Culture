/**
 * Generate ZPL code for a dispatch pallet label
 *
 * Designed for 4" x 6" (100mm x 150mm) direct thermal labels on Zebra ZD421 printer.
 * Used to label physical pallets being loaded onto trucks. Includes a QR code,
 * distributor name, batch number, order list, and a blank "PALLET ___ OF ___"
 * field for the operator to fill in by hand.
 *
 * @example
 *   generateDispatchLabelZpl({
 *     batchNumber: 'BATCH-2026-0042',
 *     distributorName: 'MMI Distribution',
 *     totalCases: 120,
 *     orderNumbers: ['SO-00145', 'SO-00146', 'PCO-0023'],
 *     dispatchedAt: new Date(),
 *     notes: 'Truck #42',
 *   });
 */

export interface DispatchLabelData {
  /** Batch number (e.g. BATCH-2026-0042) */
  batchNumber: string;
  /** Distributor / recipient name */
  distributorName: string;
  /** Total cases in the batch */
  totalCases: number;
  /** Order numbers included in the batch */
  orderNumbers: string[];
  /** Date dispatched */
  dispatchedAt: Date;
  /** Optional notes (e.g. truck number) */
  notes?: string | null;
}

/**
 * Normalize accented characters to ASCII equivalents for thermal printers
 */
const normalizeAccents = (str: string) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/ß/g, 'ss');
};

/**
 * Escape special characters for ZPL
 */
const escapeZpl = (str: string) => {
  return normalizeAccents(str).replace(/\^/g, ' ').replace(/~/g, ' ');
};

/**
 * Truncate string to max length with ellipsis
 */
const truncate = (str: string, maxLen: number) => {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
};

/**
 * Format date as YYYY-MM-DD
 */
const formatDate = (date: Date) => {
  return new Date(date).toISOString().split('T')[0];
};

/**
 * Generate ZPL code for a dispatch pallet label
 *
 * Label layout (4" x 6" at 203 DPI = 812 x 1218 dots):
 * - Top: Company header + QR code (top-right)
 * - Middle: Distributor name (large), batch number, case count
 * - Bottom: Order numbers list, notes, pallet blank
 */
const generateDispatchLabelZpl = (data: DispatchLabelData) => {
  const batchNumber = escapeZpl(data.batchNumber);
  const distributorName = escapeZpl(truncate(data.distributorName, 28));
  const dispatchDate = formatDate(data.dispatchedAt);
  const notesText = data.notes ? escapeZpl(truncate(data.notes, 36)) : '';

  // Build order number lines (show up to 8 orders)
  const displayOrders = data.orderNumbers.slice(0, 8);
  const orderLines = displayOrders
    .map((orderNum, i) => {
      const yPos = 620 + i * 38;
      return `^FO70,${yPos}
^A0N,26,26
^FD${escapeZpl(orderNum)}^FS`;
    })
    .join('\n');

  const moreOrdersLine =
    data.orderNumbers.length > 8
      ? `^FO70,${620 + 8 * 38}
^A0N,22,22
^FD+${data.orderNumbers.length - 8} more orders^FS`
      : '';

  // Calculate y position after orders list for notes
  const ordersEndY = 620 + Math.min(data.orderNumbers.length, 8) * 38 + (data.orderNumbers.length > 8 ? 38 : 0);
  const notesY = ordersEndY + 16;

  const zpl = `^XA

^FX -- Label dimensions: 4" x 6" at 203 DPI --
^PW812
^LL1218

^FX -- Company header --
^FO50,30
^A0N,28,28
^FDCraft & Culture Warehouse^FS

^FX -- Horizontal separator --
^FO30,70
^GB752,3,3^FS

^FX -- QR Code (top-right) --
^FO600,90
^BQN,2,6
^FDMA,${data.batchNumber}^FS

^FX -- Distributor name (large) --
^FO50,100
^A0N,56,56
^FDTO:^FS

^FO50,165
^A0N,52,52
^FD${distributorName}^FS

^FX -- Horizontal separator --
^FO30,240
^GB752,2,2^FS

^FX -- Batch number --
^FO50,260
^A0N,36,36
^FD${batchNumber}^FS

^FX -- Date --
^FO50,310
^A0N,26,26
^FDDate: ${dispatchDate}^FS

^FX -- Total cases (large, right-aligned area) --
^FO530,260
^A0N,80,80
^FD${data.totalCases}^FS

^FO530,345
^A0N,24,24
^FDCASES^FS

^FX -- Horizontal separator --
^FO30,380
^GB752,2,2^FS

^FX -- Pallet blank (hand-write) --
^FO50,400
^A0N,44,44
^FDPALLET _____ OF _____^FS

^FX -- Horizontal separator --
^FO30,460
^GB752,2,2^FS

^FX -- Orders header --
^FO50,480
^A0N,28,28
^FDORDERS:^FS

^FO50,520
^A0N,22,22
^FD${data.orderNumbers.length} order${data.orderNumbers.length !== 1 ? 's' : ''} in this batch^FS

^FX -- Horizontal separator --
^FO50,555
^GB712,1,1^FS

^FX -- Order numbers list --
${orderLines}

${moreOrdersLine}

${notesText ? `^FX -- Notes --
^FO30,${notesY}
^GB752,1,1^FS
^FO50,${notesY + 16}
^A0N,24,24
^FDNotes: ${notesText}^FS` : ''}

^FX -- Bottom separator --
^FO30,1160
^GB752,2,2^FS

^FX -- Barcode text at bottom --
^FO50,1175
^A0N,18,18
^FD${data.batchNumber} | ${dispatchDate} | ${data.totalCases} cases^FS

^XZ`;

  return zpl;
};

export default generateDispatchLabelZpl;
