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
 * Programme scope for a triangulation query.
 *
 * Optional everywhere, so a caller that predates multi-client keeps working and
 * keeps reading the same figures.
 */
export const programmeIdSchema = z
  .string()
  .uuid()
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
