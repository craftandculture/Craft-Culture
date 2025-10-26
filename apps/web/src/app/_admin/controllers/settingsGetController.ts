import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { settings } from '@/database/schema';

/**
 * Get settings by key
 *
 * @example
 *   await settingsGetController({ key: 'leadTimeMin' });
 *
 * @param input - Settings key to retrieve
 * @returns Settings value or default
 */
const settingsGetController = async (input: { key: string }) => {
  const setting = await db.query.settings.findFirst({
    where: eq(settings.key, input.key),
  });

  return setting?.value ?? null;
};

export default settingsGetController;
