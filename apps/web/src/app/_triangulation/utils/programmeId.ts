import { z } from 'zod';

/**
 * The programme the tool was built for, and the one every query falls back to.
 *
 * Fixed rather than looked up so it can be both a column default in the schema
 * and the default here: a request that names no programme is a request about
 * Crurated, which is what every caller meant before programmes existed.
 */
export const CRURATED_PROGRAMME_ID = '11111111-1111-1111-1111-111111111111';

/**
 * A uuid as Postgres defines one, which is looser than RFC 4122.
 *
 * `z.string().uuid()` also checks the version and variant nibbles, and the
 * seeded programme id fails on the variant: the 17th hex digit has to be 8, 9,
 * a or b, and a readable constant of all ones is not. Postgres stores and
 * compares it perfectly well, so the database was never the problem — every
 * scoped query simply 400'd the moment the client started sending the id, and
 * each one renders an empty state rather than an error, which looks exactly
 * like the client's data having been deleted.
 *
 * Shape-checking is all this needs to do. The value reaches SQL as a bound
 * parameter, and a wrong-but-well-formed id returns nothing rather than
 * somebody else's rows.
 */
export const uuidLike = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    { message: 'Expected a uuid' },
  );

/**
 * Programme scope for a triangulation query.
 *
 * Optional everywhere, so a caller that predates multi-client keeps working and
 * keeps reading the same figures.
 */
export const programmeIdSchema = uuidLike
  .optional()
  .nullable()
  .transform((value) => value ?? CRURATED_PROGRAMME_ID);

/**
 * Resolve the programme a query is about
 *
 * @param programmeId - Programme from the request, if it named one
 * @returns The programme id to scope by
 */
const resolveProgrammeId = (programmeId?: string | null) =>
  programmeId ?? CRURATED_PROGRAMME_ID;

export default resolveProgrammeId;
