import serverConfig from '@/server.config';

import type { WarehouseEmailData } from '../types';

/**
 * The orderUpdate template's variables with every list present and every
 * text filled, so Loops never refuses the email for an empty variable
 *
 * @param data - What this email says
 * @returns The complete variables
 */
const warehouseEmailData = (
  data: Pick<WarehouseEmailData, 'subject' | 'preheader' | 'label' | 'eyebrow' | 'headline' | 'name' | 'body'> &
    Partial<WarehouseEmailData>,
): WarehouseEmailData => ({
  note: [],
  action: [],
  ctaLabel: 'View your orders',
  ctaUrl: `${serverConfig.appUrl}/platform/distributor/orders`,
  secondary: [],
  steps: [],
  winesTitle: [],
  wines: [],
  winesMore: [],
  rows: [],
  ...data,
  name: data.name.trim() || 'Sir or Madam',
});

export default warehouseEmailData;
