import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';

export interface GroupableLine {
  lwin?: string | null;
  supplierSku?: string | null;
  productName: string;
  vintage?: number | null;
  bottleSizeMl?: number | null;
}

/**
 * Which lines on a shipment are the same wine in different packs
 *
 * The one definition, used both to put pack sizes side by side and to check
 * them against the document together, so the two can never disagree about
 * what "the same wine" means. A LWIN without its pack digits decides it —
 * wine, vintage and bottle size, any pack. Without a LWIN, the supplier's own
 * code, then the name and vintage as billed.
 *
 * @example
 *   wineGroupKey({ lwin: '1063145-2022-03-00750', productName: 'x' });
 *   // 'lwin:1063145-2022-00750'
 *
 * @param line - A shipment line
 * @returns A key shared by every pack size of the same wine
 */
const wineGroupKey = (line: GroupableLine) => {
  const parts = line.lwin ? String(normalizeLwin18(line.lwin)).split('-') : [];

  if (parts.length === 4) {
    return `lwin:${parts[0]}-${parts[1]}-${parts[3]}`;
  }

  const sku = line.supplierSku?.trim().toUpperCase();

  if (sku) return `sku:${sku}`;

  const name = line.productName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  return `name:${name}|${line.vintage ?? ''}|${line.bottleSizeMl ?? 750}`;
};

export default wineGroupKey;
