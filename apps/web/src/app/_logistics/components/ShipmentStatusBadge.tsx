'use client';

import type { LogisticsShipment } from '@/database/schema';

type ShipmentStatus = LogisticsShipment['status'];

const statusConfig: Record<ShipmentStatus, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  booked: {
    label: 'Booked',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  picked_up: {
    label: 'Picked Up',
    className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  },
  in_transit: {
    label: 'In Transit',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  arrived_port: {
    label: 'Arrived Port',
    className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  },
  customs_clearance: {
    label: 'Customs',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  cleared: {
    label: 'Cleared',
    className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  },
  at_warehouse: {
    label: 'At Warehouse',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  partially_received: {
    label: 'Receiving',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  dispatched: {
    label: 'Dispatched',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  delivered: {
    label: 'Delivered',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
};

interface ShipmentStatusBadgeProps {
  status: ShipmentStatus;
}

/**
 * Status badge component for logistics shipments
 */
const ShipmentStatusBadge = ({ status }: ShipmentStatusBadgeProps) => {
  const config = statusConfig[status] ?? statusConfig.draft;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
};

export default ShipmentStatusBadge;
