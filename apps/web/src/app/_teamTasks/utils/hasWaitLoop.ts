/**
 * Whether any part of a job waits, directly or along a chain, on itself
 *
 * A part that waits for another cannot be ticked until that one is done, so
 * A waiting for B while B waits for A (or any longer loop) leaves every part
 * in the loop blocked for good, and the job can never close.
 *
 * @example
 *   hasWaitLoop([{ waitsForIndex: 1 }, { waitsForIndex: 0 }]); // true
 *   hasWaitLoop([{ waitsForIndex: null }, { waitsForIndex: 0 }]); // false
 *
 * @param parts - The job's parts, each naming the index of the part it waits for
 * @returns True when following "waits for" from some part comes back round
 */
const hasWaitLoop = (parts: { waitsForIndex: number | null }[]) =>
  parts.some((_, start) => {
    const seen = new Set<number>();
    let at: number | null | undefined = start;
    while (at !== null && at !== undefined && at >= 0) {
      if (seen.has(at)) return true;
      seen.add(at);
      at = parts[at]?.waitsForIndex;
    }
    return false;
  });

export default hasWaitLoop;
