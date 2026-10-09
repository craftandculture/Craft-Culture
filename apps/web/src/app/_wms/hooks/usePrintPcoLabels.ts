'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import usePrint from '@/app/_wms/hooks/usePrint';
import { generateBatchLabelsZpl } from '@/app/_wms/utils/generateLabelZpl';

/** A single line item on a private-client order, as needed for its label. */
export interface PcoLabelItem {
  productName?: string | null;
  lwin?: string | null;
  bottleSize?: string | number | null;
  quantity?: number | null;
  caseConfig?: number | null;
  vintage?: number | string | null;
}

/** The subset of a private-client order needed to print its client labels. */
export interface PcoLabelOrder {
  orderNumber?: string | null;
  caseCount?: number | null;
  partner?: { businessName?: string | null } | null;
  /** The distributor's bundle SKU (City Drinks), printed when there is one */
  distributorSku?: string | null;
  items?: PcoLabelItem[] | null;
}

/** One case's label, keyed so it can be reprinted on its own. */
export interface PcoCaseLabel {
  key: string;
  /** Which case of the line this is, from 1 */
  caseNumber: number;
  casesOnLine: number;
  data: Parameters<typeof generateBatchLabelsZpl>[0][number];
}

/**
 * Print the 4x2" client labels for a private-client order (PCO) to a Zebra
 * printer. Shared by the order detail screen and the WMS pick flow so both
 * produce byte-identical labels from one code path.
 *
 * @example
 *   const { printLabels, isPrinting } = usePrintPcoLabels();
 *   await printLabels(order);
 */
const usePrintPcoLabels = () => {
  const { print } = usePrint();
  const [isPrinting, setIsPrinting] = useState(false);

  /**
   * Every label the order needs — ONE PER CASE, in order.
   *
   * A line of two cases is two boxes on a pallet, and each box needs its own
   * label; printing one per line left the second box of every multi-case line
   * bare. Each label says which case it is ("case 2 of 2") so a missing one is
   * obvious and can be reprinted on its own.
   */
  const buildLabels = (order: PcoLabelOrder): PcoCaseLabel[] => {
    const items = order.items ?? [];
    const totalCases =
      order.caseCount ?? items.reduce((sum, i) => sum + Math.max(1, i.quantity ?? 1), 0);

    // The label is unchanged apart from the distributor's SKU, appended to
    // the order line when there is one. Plain ASCII: the label font has no
    // middle dot, and ' | ' is the generator's own line separator.
    const orderLine = `Total Order: ${totalCases} ${totalCases === 1 ? 'Case' : 'Cases'}${
      order.distributorSku ? `  CD SKU ${order.distributorSku}` : ''
    }`;

    return items.flatMap((item, line) => {
      const lwin = item.lwin || 'UNKNOWN';
      const bottleSizeNum = parseInt(
        String(item.bottleSize ?? '75').replace(/\D/g, ''),
        10,
      );
      const bottleSizeCl = bottleSizeNum > 200 ? bottleSizeNum / 10 : bottleSizeNum;
      const qty = Math.max(1, item.quantity ?? 1);
      // A label is physical and travels with the goods, so an assumed pack
      // becomes a wrong fact on a case in a warehouse. Where the pack is not
      // known, say so rather than assert twelve.
      const pack = item.caseConfig
        ? `${item.caseConfig}x${bottleSizeCl}cl`
        : 'pack not set';

      return Array.from({ length: qty }, (_, at) => ({
        key: `${line}-${at + 1}`,
        caseNumber: at + 1,
        casesOnLine: qty,
        data: {
          showBarcode: false,
          productName: item.productName || 'Unknown Product',
          lwin18: lwin,
          packSize:
            qty === 1 ? `${pack} | 1 case` : `${pack} | case ${at + 1} of ${qty}`,
          vintage: item.vintage || undefined,
          lotNumber: `${order.orderNumber || 'PCO'} | ${orderLine}`,
          owner: order.partner?.businessName || undefined,
        },
      }));
    });
  };

  /**
   * Print the order's case labels — all of them, or only the keys given.
   *
   * @param order - The private-client order
   * @param only - Keys from `buildLabels` to print, to replace a missed label
   */
  const printLabels = async (order: PcoLabelOrder, only?: string[]) => {
    if (!order.items || order.items.length === 0) {
      toast.error('No items to label');
      return false;
    }

    setIsPrinting(true);
    try {
      const all = buildLabels(order);
      const labels = only ? all.filter((label) => only.includes(label.key)) : all;

      if (labels.length === 0) {
        toast.error('No labels selected');
        return false;
      }

      const zpl = generateBatchLabelsZpl(labels.map((label) => label.data));
      const success = await print(zpl, '4x2');
      if (success) {
        toast.success(`Printed ${labels.length} label${labels.length === 1 ? '' : 's'}`);
      } else {
        toast.error('Failed to reach printer — check WiFi connection');
      }
      return success;
    } catch {
      toast.error('Failed to generate labels');
      return false;
    } finally {
      setIsPrinting(false);
    }
  };

  return { printLabels, buildLabels, isPrinting };
};

export default usePrintPcoLabels;
