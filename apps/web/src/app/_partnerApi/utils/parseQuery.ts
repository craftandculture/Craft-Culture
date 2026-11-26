import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';

import PartnerApiBadRequest from '@/app/api/v1/_utils/PartnerApiBadRequest';

/**
 * Parse a request's query string with a schema, or answer 400
 *
 * Unknown parameters are passed to the schema too, which ignores them; a
 * known one that fails says which and why.
 *
 * @example
 *   const query = parseQuery(request, movementsQuerySchema);
 *
 * @param request - The incoming request
 * @param schema - The Zod schema for the query
 * @returns The parsed query
 */
const parseQuery = <T>(request: NextRequest, schema: ZodType<T>) => {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = schema.safeParse(raw);

  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join('.') || 'query';
    throw new PartnerApiBadRequest(`Invalid ${field}: ${issue?.message ?? 'bad value'}`);
  }

  return result.data;
};

export default parseQuery;
