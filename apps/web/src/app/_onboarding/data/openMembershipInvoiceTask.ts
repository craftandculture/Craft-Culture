import { inArray } from 'drizzle-orm';

import announceTask from '@/app/_teamTasks/data/announceTask';
import logTaskEvent from '@/app/_teamTasks/data/logTaskEvent';
import resolveArea from '@/app/_teamTasks/data/resolveArea';
import writeParts from '@/app/_teamTasks/data/writeParts';
import dubaiToday from '@/app/_teamTasks/utils/dubaiToday';
import db from '@/database/client';
import { teamTasks, users } from '@/database/schema';
import logger from '@/utils/logger';

import cellarTeamEmails from '../constants/cellarTeamEmails';

interface OpenMembershipInvoiceTaskParams {
  memberName: string;
  partnerId: string;
  membershipFeeAed: number;
}

/**
 * Open a Team Tasks job to set up a new member's monthly invoice
 *
 * With membership billed through Zoho Books rather than a card subscription,
 * nothing charges the member until someone sets up the recurring invoice. A
 * job on the shared list is what makes sure that happens, and that it is seen
 * to have happened. Failure here never blocks the member's activation.
 *
 * @param params - The member and their monthly fee
 * @returns Whether a job was opened
 */
const openMembershipInvoiceTask = async ({
  memberName,
  partnerId,
  membershipFeeAed,
}: OpenMembershipInvoiceTaskParams) => {
  try {
    const people = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.email, [...cellarTeamEmails]));
    if (!people.length) return false;

    const today = dubaiToday();
    const what = `Zoho Books → new recurring invoice: AED ${membershipFeeAed.toLocaleString('en-GB')} monthly (VAT as confirmed by our tax adviser), starting today. Extra storage is added from Cellar members → Storage each month. Then link the member to that Zoho customer (Cellar members → Members, Zoho column) so their invoices appear on their Invoices page.`;

    const taskId = await db.transaction(async (tx) => {
      const areaId = await resolveArea(tx, null, 'Private Cellar');
      const [task] = await tx
        .insert(teamTasks)
        .values({
          title: `${memberName} — set up monthly membership invoice`,
          areaId,
          forTag: 'client',
          linkUrl: '/platform/admin/cellar-members?tab=storage',
          linkLabel: memberName,
          partnerId: null,
        })
        .returning({ id: teamTasks.id });
      await writeParts(
        tx,
        task!.id,
        people.map((person) => ({ ownerId: person.id, what, due: today, waitsForIndex: null })),
      );
      return task!.id;
    });

    await logTaskEvent(taskId, null, `Opened when ${memberName} activated their cellar (partner ${partnerId})`);
    await announceTask(taskId, 'opened');
    return true;
  } catch (error) {
    logger.error('Could not open membership invoice task', { error, partnerId });
    return false;
  }
};

export default openMembershipInvoiceTask;
