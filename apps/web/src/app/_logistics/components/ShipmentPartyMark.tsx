'use client';

import type { ComponentType } from 'react';

import { type ShipmentType, shipmentTypeConfig } from './ShipmentTypeBadge';

/**
 * The square at the start of a shipment row
 *
 * Shows the partner's or client's logo when there is one, so a row can be
 * recognised at a glance; otherwise the transport icon on the type's colour,
 * as before. The type badge beside the name still says the direction.
 */
const ShipmentPartyMark = ({
  type,
  logoUrl,
  name,
  icon: ModeIcon,
}: {
  type: ShipmentType;
  logoUrl: string | null | undefined;
  name: string | null | undefined;
  icon: ComponentType<{ size?: number; className?: string }>;
}) => {
  if (logoUrl) {
    return (
      <span className={`flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 ring-1 ring-border-muted`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- partner logos come from Blob at any size */}
        <img src={logoUrl} alt={name ?? ''} className="max-h-full max-w-full object-contain" />
      </span>
    );
  }

  const tile = shipmentTypeConfig[type]?.tile ?? 'bg-surface-secondary text-text-muted';
  return (
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tile}`}>
      <ModeIcon size={18} />
    </span>
  );
};

export default ShipmentPartyMark;
