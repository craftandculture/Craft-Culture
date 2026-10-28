import isUniqueViolation from '@/app/_logistics/utils/isUniqueViolation';

/**
 * Run an insert that takes a fresh reference number, retrying on a clash
 *
 * Reference numbers are the next after the highest on file, so two saves in the
 * same moment can pick the same one. The unique index refuses the second, and
 * this tries again with the attempt number, which the caller passes as the
 * offset to `nextYearNumber`.
 *
 * Inside a transaction, wrap the insert in `tx.transaction(...)` (a savepoint)
 * so a refused insert does not abort the whole transaction.
 *
 * @example
 *   await withNumberRetry((attempt) =>
 *     insertWith(await nextNumber(tx, attempt)),
 *   );
 *
 * @param run - The insert, given the attempt number (0, 1, 2…)
 * @param attempts - How many tries before giving up
 * @returns Whatever the insert returns
 */
const withNumberRetry = async <T>(
  run: (attempt: number) => Promise<T>,
  attempts = 5,
): Promise<T> => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run(attempt);
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= attempts - 1) throw error;
    }
  }
};

export default withNumberRetry;
