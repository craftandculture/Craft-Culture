import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import tryCatch from '@/utils/tryCatch';

/** The internal briefs this route serves, by the name in the URL */
const DOCS = new Set(['platform-mvp', 'logistics-plan', 'source-flows', 'inbound-cellar']);

/**
 * Serve an internal HTML brief to C&C staff
 *
 * These pages used to sit in `public/`, where anyone with the address could
 * read them: the platform planning brief, module plans and an inbound list.
 * They now live outside `public/` and are read from disk only for a staff
 * session, so a partner login or a guessed URL gets nothing.
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) => {
  const { name } = await params;

  if (!DOCS.has(name)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [user] = await tryCatch(getCurrentUser());

  if (!user || !isTeamMember(user)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [html, readError] = await tryCatch(
    readFile(path.join(process.cwd(), 'internal-docs', `${name}.html`), 'utf8'),
  );

  if (readError) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};
