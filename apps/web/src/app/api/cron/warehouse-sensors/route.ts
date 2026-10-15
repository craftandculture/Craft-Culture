import { NextResponse } from 'next/server';

import alertSilentSensors from '@/app/_warehouse/data/alertSilentSensors';
import isCronAuthorised from '@/lib/cron/isCronAuthorised';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * Warehouse sensor watch, on Vercel's schedule every 15 minutes
 *
 * Posts to #warehouse-data when a cold room or warehouse sensor has gone
 * 30 minutes without a reading. Out-of-range readings are alerted as they
 * arrive, by the sensor endpoint itself. Refuses any call without
 * `Authorization: Bearer <CRON_SECRET>`, and every call when the secret is
 * unset.
 */
export const GET = async (request: Request) => {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const silent = await alertSilentSensors();
    return NextResponse.json({ silent });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Warehouse sensor watch failed', { error: message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
