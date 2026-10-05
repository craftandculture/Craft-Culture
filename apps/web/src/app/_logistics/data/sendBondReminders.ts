import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import announceTask from '@/app/_teamTasks/data/announceTask';
import logTaskEvent from '@/app/_teamTasks/data/logTaskEvent';
import resolveArea from '@/app/_teamTasks/data/resolveArea';
import writeParts from '@/app/_teamTasks/data/writeParts';
import dubaiToday from '@/app/_teamTasks/utils/dubaiToday';
import shortDate from '@/app/_teamTasks/utils/shortDate';
import db from '@/database/client';
import { logisticsJobs, logisticsMovementBonds, teamTasks, users } from '@/database/schema';

import {
  CLAIM_WARNING_DAYS,
  REFUND_CHASE_DAYS,
  STAMP_CHASE_DAYS,
  bondStatus,
  daysBetween,
} from '../utils/bondStatus';

/** Who runs bond claims, and who is told when one is close to being lost */
const OPERATOR_EMAIL = 'jyothi@craftculture.xyz';
const ESCALATION_EMAIL = 'kevin@craftculture.xyz';

interface Reminder {
  key: string;
  title: string;
  what: string;
  due: string;
  urgent: boolean;
  escalate: boolean;
}

const money = (amount: number | null, currency: string) =>
  amount == null ? 'the bond' : `${currency} ${Math.round(amount).toLocaleString('en-GB')}`;

/**
 * Turn every movement bond that needs attention into a Team Task
 *
 * Run each morning. Three things are chased: stamped paperwork not back a
 * week after the goods arrived; a claim not yet submitted as the three-month
 * window closes (at 30, 14 and 7 days, and once if it passes); and a refund
 * not received four weeks after the claim. From seven days out the job also
 * goes to Kevin.
 *
 * Each reminder is keyed on the date it counts from, and remembered on the
 * bond, so it is sent once — and sent again only if that date is corrected.
 *
 * @param now - The moment to judge by
 * @returns How many tasks were opened
 */
const sendBondReminders = async (now = new Date()) => {
  const today = dubaiToday(now);

  const rows = await db
    .select({ bond: logisticsMovementBonds, jobNumber: logisticsJobs.jobNumber, clientName: logisticsJobs.clientName })
    .from(logisticsMovementBonds)
    .innerJoin(logisticsJobs, eq(logisticsJobs.shipmentId, logisticsMovementBonds.shipmentId))
    .where(and(isNull(logisticsMovementBonds.refundedOn), isNotNull(logisticsMovementBonds.paidOn)));

  if (!rows.length) return { opened: 0 };

  const people = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(sql`lower(${users.email})`, [OPERATOR_EMAIL, ESCALATION_EMAIL]));
  const operator = people.find((p) => p.email.toLowerCase() === OPERATOR_EMAIL) ?? null;
  const escalation = people.find((p) => p.email.toLowerCase() === ESCALATION_EMAIL) ?? null;
  const owner = operator ?? escalation;

  if (!owner) return { opened: 0, reason: 'no one to give the reminders to' };

  let opened = 0;

  for (const { bond, jobNumber, clientName } of rows) {
    const status = bondStatus(bond, today);
    const held = money(bond.bondAmount, bond.currency);
    const reminders: Reminder[] = [];

    if (bond.arrivedOn && !bond.stampedOn && daysBetween(bond.arrivedOn, today) >= STAMP_CHASE_DAYS) {
      reminders.push({
        key: `stamp:${bond.arrivedOn}`,
        title: `${jobNumber} — collect stamped bond paperwork`,
        what: `Get the customs-stamped paperwork for ${clientName} and upload it to the job (${held} held)`,
        due: today,
        urgent: false,
        escalate: false,
      });
    }

    if (!bond.claimSubmittedOn && status.deadline && status.daysLeft !== null) {
      if (status.daysLeft < 0) {
        reminders.push({
          key: `expired:${bond.paidOn}`,
          title: `${jobNumber} — bond claim window has passed`,
          what: `The claim for ${held} was due ${shortDate(status.deadline)}. Contact customs today`,
          due: today,
          urgent: true,
          escalate: true,
        });
      } else {
        // The tightest warning that applies; the wider ones are already past
        const tier = [...CLAIM_WARNING_DAYS].reverse().find((d) => status.daysLeft! <= d);
        if (tier) {
          reminders.push({
            key: `claim${tier}:${bond.paidOn}`,
            title: `${jobNumber} — submit bond claim (claim by ${shortDate(status.deadline)})`,
            what: `Submit the stamped paperwork to customs to redeem ${held}. ${status.daysLeft} days left`,
            due: status.deadline,
            urgent: tier === 7,
            escalate: tier === 7,
          });
        }
      }
    }

    if (
      bond.claimSubmittedOn &&
      !bond.refundedOn &&
      daysBetween(bond.claimSubmittedOn, today) >= REFUND_CHASE_DAYS
    ) {
      reminders.push({
        key: `refund:${bond.claimSubmittedOn}`,
        title: `${jobNumber} — chase bond refund`,
        what: `Claim for ${held} went in ${shortDate(bond.claimSubmittedOn)} and has not been refunded. Chase customs`,
        due: today,
        urgent: false,
        escalate: false,
      });
    }

    const fresh = reminders.filter((r) => !bond.remindersSent.includes(r.key));

    for (const reminder of fresh) {
      const parts = [{ ownerId: owner.id, what: reminder.what, due: reminder.due, waitsForIndex: null }];
      if (reminder.escalate && escalation && escalation.id !== owner.id) {
        parts.push({ ownerId: escalation.id, what: `Check ${jobNumber}'s bond claim is in hand`, due: reminder.due, waitsForIndex: null });
      }

      const taskId = await db.transaction(async (tx) => {
        const areaId = await resolveArea(tx, null, 'Logistics');
        const [task] = await tx
          .insert(teamTasks)
          .values({
            title: reminder.title,
            areaId,
            urgent: reminder.urgent,
            linkUrl: `/platform/admin/logistics/exports/${bond.shipmentId}`,
            linkLabel: jobNumber,
          })
          .returning({ id: teamTasks.id });
        await writeParts(tx, task!.id, parts);
        await tx
          .update(logisticsMovementBonds)
          .set({ remindersSent: sql`array_append(${logisticsMovementBonds.remindersSent}, ${reminder.key})` })
          .where(eq(logisticsMovementBonds.id, bond.id));
        return task!.id;
      });

      await logTaskEvent(taskId, null, 'Opened by the movement bond reminder');
      await announceTask(taskId, 'opened');
      opened += 1;
    }
  }

  return { opened };
};

export default sendBondReminders;
