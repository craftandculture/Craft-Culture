import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { settings } from '@/database/schema';

/**
 * Update or create a setting
 *
 * @example
 *   await settingsUpdateController({ key: 'leadTimeMin', value: '14' });
 *
 * @param input - Settings key and value to update
 * @returns Updated setting
 */
const settingsUpdateController = async (input: { key: string; value: string }) => {
  const existingSetting = await db.query.settings.findFirst({
    where: eq(settings.key, input.key),
  });

  if (existingSetting) {
    const [updated] = await db
      .update(settings)
      .set({ value: input.value })
      .where(eq(settings.key, input.key))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(settings)
    .values({
      key: input.key,
      value: input.value,
    })
    .returning();

  return created;
};

export default settingsUpdateController;
