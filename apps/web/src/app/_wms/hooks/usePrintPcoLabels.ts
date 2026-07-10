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
  items?: PcoLabelItem[] | null;
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

  const printLabels = async (order: PcoLabelOrder) => {
    if (!order.items || order.items.length === 0) {
      toast.error('No items to label');
      return false;
    }

    setIsPrinting(true);
    try {
      const totalCases =
        order.caseCount ??
        order.items.reduce((sum, i) => sum + (i.quantity ?? 1), 0);

      const labels = order.items.map((item) => {
        const lwin = item.lwin || 'UNKNOWN';
        const bottleSizeNum = parseInt(
          String(item.bottleSize ?? '75').replace(/\D/g, ''),
          10,
        );
        const bottleSizeCl = bottleSizeNum > 200 ? bottleSizeNum / 10 : bottleSizeNum;
        const qty = item.quantity ?? 1;
        const packSize = `${item.caseConfig ?? 12}x${bottleSizeCl}cl | ${qty} ${qty === 1 ? 'case' : 'cases'}`;
        return {
          showBarcode: false,
          productName: item.productName || 'Unknown Product',
          lwin18: lwin,
          packSize,
          vintage: item.vintage || undefined,
          lotNumber: `${order.orderNumber || 'PCO'} | Total Order: ${totalCases} ${totalCases === 1 ? 'Case' : 'Cases'}`,
          owner: order.partner?.businessName || undefined,
        };
      });

      const zpl = generateBatchLabelsZpl(labels);
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

  return { printLabels, isPrinting };
};

export default usePrintPcoLabels;
