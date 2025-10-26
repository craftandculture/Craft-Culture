import db from '@/database/client';

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
    where: {
      key: input.key,
    },
  });

  return setting?.value ?? null;
};

export default settingsGetController;
