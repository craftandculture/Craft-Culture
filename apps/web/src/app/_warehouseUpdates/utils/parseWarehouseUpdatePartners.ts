import type { WarehouseUpdatePrefs } from '../types';

/**
 * Read the distributors that receive warehouse updates from the setting,
 * tolerating a missing or damaged value (nobody receives anything)
 *
 * @param value - The stored JSON
 * @returns Each enabled distributor's preferences, by partner id
 */
const parseWarehouseUpdatePartners = (value: string | null | undefined) => {
  const prefs = new Map<string, WarehouseUpdatePrefs>();
  if (!value) return prefs;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return prefs;
    for (const [partnerId, raw] of Object.entries(parsed as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as { picked?: unknown; summary?: unknown };
      prefs.set(partnerId, {
        picked: entry.picked === 'immediate' ? 'immediate' : 'grouped',
        summary: entry.summary !== false,
      });
    }
  } catch {
    // A damaged value sends nothing rather than guessing
  }
  return prefs;
};

export default parseWarehouseUpdatePartners;
