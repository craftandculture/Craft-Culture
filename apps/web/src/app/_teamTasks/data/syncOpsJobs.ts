import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import db from '@/database/client';
import { opsCheckItems, teamTaskParts, teamTasks } from '@/database/schema';
import escapeSlackText from '@/lib/slack/escapeSlackText';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import getTeam from './getTeam';
import logTaskEvent from './logTaskEvent';
import resolveArea from './resolveArea';
import runOpsChecks from './runOpsChecks';
import type { OpsCheckResult } from './runOpsChecks';
import dubaiToday from '../utils/dubaiToday';
import postTasksSlack from '../utils/postTasksSlack';
import slackTag from '../utils/slackTag';

type Member = Awaited<ReturnType<typeof getTeam>>[number];

/** The job a check keeps open, if it has one */
const openJobFor = async (checkKey: string) => {
  const [row] = await db
    .select({ id: teamTasks.id })
    .from(opsCheckItems)
    .innerJoin(teamTasks, eq(teamTasks.id, opsCheckItems.taskId))
    .where(and(eq(opsCheckItems.checkKey, checkKey), eq(teamTasks.status, 'open')))
    .orderBy(desc(teamTasks.createdAt))
    .limit(1);
  return row?.id ?? null;
};

/**
 * Add a part for each new record, opening the check's job if it has none
 *
 * @returns The job id
 */
const addFindings = async (
  check: OpsCheckResult,
  fresh: OpsCheckResult['findings'],
  owner: Member,
  existingTaskId: string | null,
) => {
  const today = dubaiToday();

  return db.transaction(async (tx) => {
    let taskId = existingTaskId;

    if (!taskId) {
      const areaId = await resolveArea(tx, null, check.area);
      const [task] = await tx
        .insert(teamTasks)
        .values({
          title: check.title,
          areaId,
          urgent: check.urgent,
          linkUrl: check.linkUrl,
          linkLabel: check.title,
        })
        .returning({ id: teamTasks.id });
      taskId = task!.id;
    }

    const [{ count }] = (await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(teamTaskParts)
      .where(eq(teamTaskParts.taskId, taskId))) as [{ count: number }];

    for (const [i, finding] of fresh.entries()) {
      const [part] = await tx
        .insert(teamTaskParts)
        .values({
          taskId,
          ownerId: owner.id,
          what: finding.what,
          due: today,
          position: count + i,
        })
        .returning({ id: teamTaskParts.id });
      await tx
        .insert(opsCheckItems)
        .values({ checkKey: check.key, recordKey: finding.recordKey, taskId, partId: part!.id })
        .onConflictDoUpdate({
          target: [opsCheckItems.checkKey, opsCheckItems.recordKey],
          set: { taskId, partId: part!.id, clearedAt: null, updatedAt: new Date() },
        });
    }

    return taskId;
  });
};

/** Post new urgent records to #tasks straight away, owner tagged */
const postUrgent = async (
  check: OpsCheckResult,
  fresh: OpsCheckResult['findings'],
  owner: Member,
  taskId: string,
) => {
  const link = `${serverConfig.appUrl}/platform/admin/tasks?job=${taskId}`;
  const lines = [
    `Urgent: *<${link}|${escapeSlackText(check.title)}>*`,
    ...fresh.map((f) => `${slackTag(owner)} ${escapeSlackText(f.what)}`),
  ];
  return postTasksSlack(lines.join('\n'));
};

/** Tick the parts whose record the check no longer finds */
const clearFixed = async (check: OpsCheckResult) => {
  if (!check.complete) return 0;

  const found = new Set(check.findings.map((f) => f.recordKey));
  const active = await db
    .select({ id: opsCheckItems.id, recordKey: opsCheckItems.recordKey, partId: opsCheckItems.partId })
    .from(opsCheckItems)
    .where(and(eq(opsCheckItems.checkKey, check.key), isNull(opsCheckItems.clearedAt)));
  const gone = active.filter((i) => !found.has(i.recordKey));
  if (!gone.length) return 0;

  const now = new Date();
  await db
    .update(opsCheckItems)
    .set({ clearedAt: now, updatedAt: now })
    .where(inArray(opsCheckItems.id, gone.map((i) => i.id)));

  const partIds = gone.map((i) => i.partId).filter((id): id is string => Boolean(id));
  if (partIds.length) {
    await db
      .update(teamTaskParts)
      .set({ done: true, doneAt: now })
      .where(and(inArray(teamTaskParts.id, partIds), eq(teamTaskParts.done, false)));
  }

  return gone.length;
};

/** Close the check's job once every part on it is done */
const closeIfDone = async (taskId: string) => {
  const parts = await db
    .select({ done: teamTaskParts.done })
    .from(teamTaskParts)
    .where(eq(teamTaskParts.taskId, taskId));
  if (!parts.length || parts.some((p) => !p.done)) return false;

  const [closed] = await db
    .update(teamTasks)
    .set({ status: 'closed', closedAt: new Date() })
    .where(and(eq(teamTasks.id, taskId), eq(teamTasks.status, 'open')))
    .returning({ id: teamTasks.id });
  if (closed) await logTaskEvent(taskId, null, 'Closed automatically: everything on it has been put right');
  return Boolean(closed);
};

/**
 * Keep one Team Tasks job per ops check in step with what the check finds
 *
 * Every record a check finds becomes a part on that check's job, given to the
 * check's owner and due today. When the record is put right the part ticks
 * itself, and when nothing is left the job closes. Urgent checks also post to
 * #tasks the moment they find something new; the rest wait for the end-of-day
 * report. A part someone ticks, or a job someone closes, is not reopened
 * while the same problem stands: it comes back only if it clears and recurs.
 *
 * @example
 *   const summary = await syncOpsJobs();
 *
 * @returns Per check: parts added and cleared; and any checks that failed
 */
const syncOpsJobs = async () => {
  const { results, failed } = await runOpsChecks();
  const team = await getTeam();
  const byEmail = new Map(team.map((m) => [m.email.toLowerCase(), m]));
  const summary: { key: string; found: number; added: number; cleared: number }[] = [];

  for (const check of results) {
    try {
      const owner = check.owners.map((e) => byEmail.get(e)).find(Boolean);
      if (!owner) {
        failed.push(`${check.key}: no owner on the team`);
        continue;
      }

      const active = await db
        .select({ recordKey: opsCheckItems.recordKey })
        .from(opsCheckItems)
        .where(and(eq(opsCheckItems.checkKey, check.key), isNull(opsCheckItems.clearedAt)));
      const known = new Set(active.map((i) => i.recordKey));
      const fresh = check.findings.filter((f) => !known.has(f.recordKey));

      let taskId = await openJobFor(check.key);

      if (fresh.length) {
        const opening = !taskId;
        taskId = await addFindings(check, fresh, owner, taskId);
        if (opening) await logTaskEvent(taskId, null, 'Opened by the ops checks');
        if (check.urgent) await postUrgent(check, fresh, owner, taskId);
      }

      const cleared = await clearFixed(check);
      if (taskId) await closeIfDone(taskId);

      summary.push({ key: check.key, found: check.findings.length, added: fresh.length, cleared });
    } catch (error) {
      logger.error('Ops check sync failed', { check: check.key, error });
      failed.push(`${check.key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { summary, failed };
};

export default syncOpsJobs;
