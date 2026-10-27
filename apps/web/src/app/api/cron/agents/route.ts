import { NextResponse } from 'next/server';

import runAdvisor from '@/app/_agents/lib/runAdvisor';
import runBuyer from '@/app/_agents/lib/runBuyer';
import runConcierge from '@/app/_agents/lib/runConcierge';
import runPricer from '@/app/_agents/lib/runPricer';
import runScout from '@/app/_agents/lib/runScout';
import runStoryteller from '@/app/_agents/lib/runStoryteller';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 800;

const runners = {
  scout: runScout,
  concierge: runConcierge,
  storyteller: runStoryteller,
  buyer: runBuyer,
  pricer: runPricer,
  advisor: runAdvisor,
} as const;

/**
 * The intelligence agents, once a week
 *
 * They ran daily on Trigger.dev and were the costliest jobs there; when it was
 * switched off in October 2026 they moved here at a weekly cadence. One agent
 * per call (`?agent=scout`), each scheduled ten minutes apart on Monday
 * morning, so a slow one cannot eat the others' time. Each records its own
 * run, exactly as Run Now does.
 *
 * Refuses any call without `Authorization: Bearer <CRON_SECRET>`, and every
 * call when the secret is unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const agent = new URL(request.url).searchParams.get('agent') as keyof typeof runners | null;
  const runner = agent ? runners[agent] : undefined;

  if (!agent || !runner) {
    return NextResponse.json({ error: `Unknown agent: ${agent ?? 'none'}` }, { status: 400 });
  }

  try {
    return NextResponse.json({ agent, ...(await runner()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Weekly agent run failed', { agent, error: message });
    return NextResponse.json({ agent, error: message }, { status: 500 });
  }
};
