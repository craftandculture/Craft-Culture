import { desc } from 'drizzle-orm';

import db from '@/database/client';
import { productUpdates } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import getPendingReleaseNotes from '../data/getPendingReleaseNotes';
import isWhatsNewEnabled from '../data/isWhatsNewEnabled';
import lintMemberCopy from '../utils/lintMemberCopy';

/**
 * Every update, for the Member Updates screen
 *
 * Each carries its copy-check result, worked out fresh on every read so a
 * rule added later applies to drafts already waiting.
 */
const adminList = staffAdminProcedure.query(async () => {
  const [rows, pending, enabled] = await Promise.all([
    db.select().from(productUpdates).orderBy(desc(productUpdates.createdAt)),
    getPendingReleaseNotes(),
    isWhatsNewEnabled(),
  ]);

  return {
    enabled,
    pendingCount: pending.length,
    updates: rows.map((row) => ({
      ...row,
      flags: row.status === 'skipped' ? [] : lintMemberCopy(row),
    })),
  };
});

export default adminList;
