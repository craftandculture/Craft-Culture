import settingsUpdateController from '@/app/_admin/controllers/settingsUpdateController';

import localInventorySyncController from './localInventorySyncController';

/**
 * Manually trigger local inventory sync
 *
 * This endpoint allows admins to manually sync local inventory from Google Sheet.
 * After sync completes, it updates the lastSync timestamp in settings.
 *
 * @example
 *   await localInventorySyncManual();
 *
 * @returns Sync result with statistics
 */
const localInventorySyncManual = async () => {
  // Run the sync
  const result = await localInventorySyncController();

  // Update last sync timestamp
  await settingsUpdateController({
    key: 'localInventoryLastSync',
    value: new Date().toISOString(),
  });

  return result;
};

export default localInventorySyncManual;
