import wineGroupKey from './wineGroupKey';
import type { GroupableLine } from './wineGroupKey';

/**
 * The document order, with each wine's pack sizes pulled together
 *
 * A supplier lists a wine's 3-pack at the top and its 6-pack halfway down.
 * Every line stays where the document put its first appearance, and the
 * wine's other packs move up to sit under it, so the table still reads
 * against the document while a wine reads as one block.
 *
 * @example
 *   groupSameWineOrder([arlaud3, vilmart, arlaud6]); // [arlaud3, arlaud6, vilmart] ids
 *
 * @param lines - The lines in their current order
 * @returns Their ids in the grouped order
 */
const groupSameWineOrder = <T extends GroupableLine & { id: string }>(lines: T[]) => {
  const blocks = new Map<string, string[]>();

  for (const line of lines) {
    const key = wineGroupKey(line);
    const block = blocks.get(key) ?? [];
    block.push(line.id);
    blocks.set(key, block);
  }

  return [...blocks.values()].flat();
};

export default groupSameWineOrder;
