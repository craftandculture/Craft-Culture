import { type SQL, and, desc, eq, gte, ilike, isNotNull, not, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { emailLog, memberEmailOutbox, orderEmailOutbox } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import emailTemplateName from '../utils/emailTemplateName';

/** The team's own addresses: a copy to one of them is not an email to a client or partner */
const TEAM_DOMAIN = '%@craftculture.xyz';

export const EMAIL_LOG_FILTERS = ['all', 'people', 'team', 'failed'] as const;

/**
 * The Sent Emails feed: every email the app has handed to Loops, newest first
 *
 * "People" are emails that reached a member, partner, distributor or client;
 * "team" are shadow copies and emails to C&C addresses. The counts cover the
 * last seven days, with the emails the switches held back (off) beside them,
 * so a release can be checked against what was meant to go.
 *
 * Reads a table added on 4 Nov 2026: until its migration has run, the feed
 * says it is not ready instead of failing.
 */
const adminGetEmailLog = staffAdminProcedure
  .input(
    z.object({
      filter: z.enum(EMAIL_LOG_FILTERS).default('all'),
      search: z.string().trim().max(100).optional(),
    }),
  )
  .query(async ({ input }) => {
    const toTeam = or(isNotNull(emailLog.shadowFor), ilike(emailLog.toEmail, TEAM_DOMAIN))!;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const conditions: SQL[] = [];
    if (input.filter === 'people') conditions.push(and(not(toTeam), sql`${emailLog.ok}`)!);
    if (input.filter === 'team') conditions.push(toTeam);
    if (input.filter === 'failed') conditions.push(sql`not ${emailLog.ok}`);
    if (input.search) {
      const term = `%${input.search.replace(/[%_\\]/g, '\\$&')}%`;
      conditions.push(
        or(
          ilike(emailLog.toEmail, term),
          ilike(emailLog.subject, term),
          ilike(emailLog.shadowFor, term),
          ilike(emailLog.reference, term),
        )!,
      );
    }

    try {
      const [rows, [counts], held] = await Promise.all([
        db
          .select()
          .from(emailLog)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(emailLog.createdAt))
          .limit(300),
        db
          .select({
            people: sql<number>`count(*) filter (where ${emailLog.ok} and not (${toTeam}))::int`,
            team: sql<number>`count(*) filter (where ${emailLog.ok} and (${toTeam}))::int`,
            failed: sql<number>`count(*) filter (where not ${emailLog.ok})::int`,
          })
          .from(emailLog)
          .where(gte(emailLog.createdAt, since)),
        Promise.all(
          [memberEmailOutbox, orderEmailOutbox].map((outbox) =>
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(outbox)
              .where(and(eq(outbox.status, 'suppressed'), gte(outbox.updatedAt, since))),
          ),
        ),
      ]);

      return {
        ready: true,
        rows: rows.map((row) => ({
          ...row,
          template: emailTemplateName(row.transactionalId),
          toTeam: Boolean(row.shadowFor) || row.toEmail.toLowerCase().endsWith('@craftculture.xyz'),
        })),
        counts: {
          people: counts?.people ?? 0,
          team: counts?.team ?? 0,
          failed: counts?.failed ?? 0,
          held: held.reduce((sum, [row]) => sum + (row?.count ?? 0), 0),
        },
      };
    } catch (error) {
      logger.warn('Sent Emails feed could not be read', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { ready: false, rows: [], counts: { people: 0, team: 0, failed: 0, held: 0 } };
    }
  });

export default adminGetEmailLog;
