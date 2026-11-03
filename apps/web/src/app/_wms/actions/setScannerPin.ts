'use server';

import settingsUpdateController from '@/app/_admin/controllers/settingsUpdateController';
import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import isStaff from '@/app/_distribution/utils/isStaff';
import { SCANNER_PIN_PATTERN, SCANNER_PIN_SETTING, hashScannerPin } from '@/app/_wms/utils/scannerPin';
import logger from '@/utils/logger';

/**
 * Set or change the warehouse scanner PIN
 *
 * Only a hash is stored. Scanners already signed in stay signed in; the new
 * PIN applies to the next scanner that signs in.
 *
 * @param pin - Six digits
 * @returns An error to show, or null
 */
const setScannerPin = async (pin: string) => {
  const user = await getCurrentUser();
  if (!isStaff(user)) return { error: 'C&C staff only.' };
  if (!SCANNER_PIN_PATTERN.test(pin)) return { error: 'The PIN must be six digits.' };

  await settingsUpdateController({ key: SCANNER_PIN_SETTING, value: await hashScannerPin(pin) });
  logger.info('[Warehouse sign-in] Scanner PIN changed', { by: user?.email });
  return { error: null as string | null };
};

export default setScannerPin;
