/**
 * A higher order function that takes a function, executes it and returns its
 * value. If the function throws an error, it will be returned as the second
 * element of the tuple.
 *
 * @param fn - The function to execute
 * @returns A tuple of [value, error]
 */
const tryCatch = async <T, E extends Error = Error>(
  fn: (() => T | Promise<T>) | Promise<T>,
) => {
  try {
    if (typeof fn === 'function') {
      return [await fn(), undefined] as const;
    } else {
      return [await fn, undefined] as const;
    }
  } catch (error) {
    if (!(error instanceof Error)) {
      throw new Error('Error is not an instance of Error');
    }
    return [undefined, error as E] as const;
  }
};

export default tryCatch;
