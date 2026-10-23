const STORAGE_KEY = 'pco-list-order';

export interface PcoListEntry {
  id: string;
  orderNumber: string;
}

/**
 * Remember the orders the PCO list is showing, in the order it shows them
 *
 * The order page reads this back for its Previous and Next buttons, so they
 * step through the same filters and sorting the list had. Kept per tab, and
 * silently skipped when the browser refuses storage.
 *
 * @param entries - The orders on the list, top to bottom
 */
export const savePcoListOrder = (entries: PcoListEntry[]) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Private windows and blocked storage: the buttons just stay hidden
  }
};

/**
 * The orders either side of one order on the last PCO list shown
 *
 * @example
 *   pcoListNeighbours('b2…'); // { previous: { id: 'a1…', orderNumber: 'PCO-2026-00083' }, next: null, position: 3, total: 3 }
 *
 * @param orderId - The order being viewed
 * @returns Its neighbours and position, or null when it is not on that list
 */
export const pcoListNeighbours = (orderId: string) => {
  let entries: PcoListEntry[] = [];
  try {
    entries = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) ?? '[]',
    ) as PcoListEntry[];
  } catch {
    return null;
  }

  const index = entries.findIndex((e) => e.id === orderId);
  if (index === -1) return null;

  return {
    previous: entries[index - 1] ?? null,
    next: entries[index + 1] ?? null,
    position: index + 1,
    total: entries.length,
  };
};
