import { NextResponse } from 'next/server';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import getOutletReorderList from '@/app/_distribution/data/getOutletReorderList';
import buildReorderWorkbook from '@/app/_distribution/utils/buildReorderWorkbook';
import canSendReorderLine from '@/app/_distribution/utils/canSendReorderLine';
import isStaff from '@/app/_distribution/utils/isStaff';
import { client } from '@/database/client';

export const dynamic = 'force-dynamic';

/**
 * Reorder watch as Excel
 *
 * GET /api/admin/reorder-watch/export?section=all|send|source&owner=<name|all>
 *
 * C&C staff only. One sheet per owner; filtered to the section and owner
 * asked for, so a consignor's list can be exported on its own and sent on.
 */
export const GET = async (request: Request) => {
  const user = await getCurrentUser();
  if (!isStaff(user)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const section = params.get('section') ?? 'all';
  const owner = params.get('owner') ?? 'all';

  const [outlet] = await client<{ id: string; name: string }[]>`
    SELECT id, name FROM cons_outlets WHERE is_active AND connector = 'api' ORDER BY name LIMIT 1
  `;
  if (!outlet) {
    return NextResponse.json({ error: 'No distributor feed is connected' }, { status: 404 });
  }

  const { lines } = await getOutletReorderList(outlet.id);
  const picked = lines.filter(
    (line) =>
      (owner === 'all' || line.owner === owner) &&
      (section === 'all' ||
        (section === 'send' ? canSendReorderLine(line) : !canSendReorderLine(line))),
  );

  const buffer = await buildReorderWorkbook(outlet.name, picked);
  const day = new Date().toISOString().slice(0, 10);
  const slug = [section !== 'all' ? (section === 'send' ? 'to-send' : 'to-source') : null, owner !== 'all' ? owner : null]
    .filter(Boolean)
    .join('-')
    .replace(/[^A-Za-z0-9-]+/g, '-');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reorder-watch-${day}${slug ? `-${slug}` : ''}.xlsx"`,
    },
  });
};
