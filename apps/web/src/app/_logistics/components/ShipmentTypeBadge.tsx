'use client';

import { IconArrowDownLeft, IconArrowUpRight, IconArrowsLeftRight, IconRepeat } from '@tabler/icons-react';

import type { LogisticsShipment } from '@/database/schema';

export type ShipmentType = LogisticsShipment['type'];

/**
 * How each shipment direction reads at a glance
 *
 * Each type has its own colour and arrow so an import, an export and a UAE to
 * UAE transfer can be told apart in a list without reading the text. Status
 * badges use green and grey, so these stay clear of both.
 */
export const shipmentTypeConfig: Record<
  ShipmentType,
  { label: string; icon: typeof IconArrowDownLeft; pill: string; tile: string }
> = {
  inbound: {
    label: 'Import',
    icon: IconArrowDownLeft,
    pill: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-900',
    tile: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  },
  outbound: {
    label: 'Export',
    icon: IconArrowUpRight,
    pill: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-900',
    tile: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  },
  mainland_transfer: {
    label: 'Mainland Transfer',
    icon: IconArrowsLeftRight,
    pill: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900',
    tile: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  },
  re_export: {
    label: 'Re-Export',
    icon: IconRepeat,
    pill: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-900',
    tile: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  },
};

export const shipmentTypeLabel = (type: ShipmentType) => shipmentTypeConfig[type]?.label ?? 'Export';

const ShipmentTypeBadge = ({ type }: { type: ShipmentType }) => {
  const config = shipmentTypeConfig[type] ?? shipmentTypeConfig.outbound;
  const TypeIcon = config.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${config.pill}`}
    >
      <TypeIcon size={12} />
      {config.label}
    </span>
  );
};

export default ShipmentTypeBadge;
