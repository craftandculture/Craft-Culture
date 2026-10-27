import isUniqueViolation from '@/app/_logistics/utils/isUniqueViolation';

/**
 * Insert a row that carries a "next number" reference, retrying on a clash
 *
 * Reference numbers (SRC-, CPO-, SO-) are the next after the highest on file,
 * so two saves in the same moment can pick the same one. The unique index
 * refuses the second; this generates a fresh number and tries again.
 *
 * @example
 *   const rfq = await insertWithNumberRetry(generateRfqNumber, (rfqNumber) =>
 *   db.insert(sourceRfqs).values({ rfqNumber, ... }).returning(),
 *   );
 *
 * @param generate - Produces the next reference number
 * @param insert - Performs the insert with that number
 * @param attempts - How many numbers to try before giving up
 * @returns Whatever the insert returns
 */
const insertWithNumberRetry = async <T>(
  generate: () => Promise<string>,
  insert: (number: string) => Promise<T>,
  attempts = 5,
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    const number = await generate();
    try {
      return await insert(number);
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= attempts) throw error;
    }
  }
};

export default insertWithNumberRetry;
