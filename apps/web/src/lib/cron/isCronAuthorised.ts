import matchesSecret from '@/utils/matchesSecret';

/**
 * Whether a request carries Vercel Cron's `Authorization: Bearer <CRON_SECRET>`
 *
 * Compared in constant time, and false whenever CRON_SECRET is unset, so a
 * cron endpoint is never left open by a missing variable.
 *
 * @example
 *   if (!isCronAuthorised(request)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
 *
 * @param request - The incoming request
 * @returns True when the bearer token matches CRON_SECRET
 */
const isCronAuthorised = (request: Request) => {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;

  return matchesSecret(header.slice('Bearer '.length), process.env.CRON_SECRET);
};

export default isCronAuthorised;
