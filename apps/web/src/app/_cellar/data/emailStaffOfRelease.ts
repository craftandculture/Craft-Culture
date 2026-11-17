import { eq } from 'drizzle-orm';

import logisticsEmailTemplateId from '@/app/_logistics/utils/logisticsEmailTemplateId';
import getTeam from '@/app/_teamTasks/data/getTeam';
import postTasksSlack from '@/app/_teamTasks/utils/postTasksSlack';
import slackTag from '@/app/_teamTasks/utils/slackTag';
import db from '@/database/client';
import {
  cellarReleaseDeliveryDetails,
  cellarReleaseRequestItems,
  cellarReleaseRequests,
  partners,
  privateClientOrders,
} from '@/database/schema';
import loops from '@/lib/loops/client';
import escapeSlackText from '@/lib/slack/escapeSlackText';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import describePreferredDelivery from '../utils/describePreferredDelivery';
import formatReleaseStaffEmail from '../utils/formatReleaseStaffEmail';

/** Who is emailed when a member's release needs the team: Sophie prices it, Laraine backs her up */
export const RELEASE_ALERT_EMAILS = ['sophie@craftculture.xyz', 'laraine@craftculture.xyz'];

/**
 * Email the team, and tag them in #tasks, when a member's release request needs them
 *
 * The bell in the Index and the #tasks tag are both easy to miss, and a
 * request sat unseen for three days (REL-2026-0012). This puts it in the
 * inbox too. It goes through the plain Loops template the logistics emails
 * use (subject plus lines of text), so no new template had to be built.
 * It therefore arrives from logistics@.
 *
 * Never throws: the member's request must not fail because an email did not.
 *
 * @example
 *   await emailStaffOfRelease({ requestId, event: 'submitted' });
 *
 * @param params - The request, and whether it was submitted, added to or accepted
 */
const emailStaffOfRelease = async ({
  requestId,
  event,
  amended,
  testTo,
}: {
  requestId: string;
  event: 'submitted' | 'accepted';
  amended?: boolean;
  /** Send only to these addresses, and post nothing to Slack: for a test */
  testTo?: string;
}) => {
  try {
    const [request] = await db
      .select({
        number: cellarReleaseRequests.requestNumber,
        address: cellarReleaseRequests.deliveryAddress,
        memberNotes: cellarReleaseRequests.memberNotes,
        submittedAt: cellarReleaseRequests.submittedAt,
        member: partners.businessName,
        orderNumber: privateClientOrders.orderNumber,
        addressLabel: cellarReleaseDeliveryDetails.addressLabel,
        instructions: cellarReleaseDeliveryDetails.deliveryInstructions,
        preferredDate: cellarReleaseDeliveryDetails.preferredDate,
        preferredWindow: cellarReleaseDeliveryDetails.preferredWindow,
        isGift: cellarReleaseDeliveryDetails.isGift,
        recipientName: cellarReleaseDeliveryDetails.recipientName,
      })
      .from(cellarReleaseRequests)
      .innerJoin(partners, eq(partners.id, cellarReleaseRequests.partnerId))
      .leftJoin(privateClientOrders, eq(privateClientOrders.id, cellarReleaseRequests.privateClientOrderId))
      .leftJoin(cellarReleaseDeliveryDetails, eq(cellarReleaseDeliveryDetails.requestId, cellarReleaseRequests.id))
      .where(eq(cellarReleaseRequests.id, requestId))
      .limit(1);

    if (!request) return;

    const items = await db
      .select({
        name: cellarReleaseRequestItems.productName,
        vintage: cellarReleaseRequestItems.vintage,
        bottleSize: cellarReleaseRequestItems.bottleSize,
        caseConfig: cellarReleaseRequestItems.caseConfig,
        bottles: cellarReleaseRequestItems.bottles,
      })
      .from(cellarReleaseRequestItems)
      .where(eq(cellarReleaseRequestItems.requestId, requestId));

    const bottles = items.reduce((sum, item) => sum + (item.bottles ?? 0), 0);
    const link = `${serverConfig.appUrl}/platform/admin/cellar-releases?open=${request.number}`;

    const { subject, lines } = formatReleaseStaffEmail({
      event,
      amended,
      requestNumber: request.number,
      member: request.member,
      items,
      address: request.address,
      addressLabel: request.addressLabel,
      preferred: describePreferredDelivery(request.preferredDate, request.preferredWindow),
      instructions: request.instructions,
      gift: request.isGift ? { recipientName: request.recipientName } : null,
      memberNotes: request.memberNotes,
      orderNumber: request.orderNumber,
      link,
      submittedAt: request.submittedAt,
    });

    const transactionalId = logisticsEmailTemplateId();
    const dataVariables = {
      subject: testTo ? `[Test] ${subject}` : subject,
      // A blank line needs a value Loops will not collapse, as in sendLogisticsEmail
      lines: lines.map((text) => ({ text: text.trim() ? text : ' ' })),
    };

    /*
      The same moment in #tasks, both people tagged, rather than waiting up to
      fifteen minutes for the ops checks to find it.
    */
    if (!testTo) try {
      const team = await getTeam();
      const tags = RELEASE_ALERT_EMAILS.map((email) =>
        slackTag(team.find((person) => person.email.toLowerCase() === email)),
      ).join(' ');
      await postTasksSlack(
        [
          `${tags} *<${link}|${escapeSlackText(subject)}>*`,
          `${items.length} ${items.length === 1 ? 'wine' : 'wines'} · ${bottles} bottles${
            request.address ? ` · ${escapeSlackText(request.address)}` : ''
          }`,
        ].join('\n'),
      );
    } catch (error) {
      logger.error('Release Slack post failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    for (const email of testTo ? [testTo] : RELEASE_ALERT_EMAILS) {
      try {
        // The Loops API takes arrays of objects for repeating blocks; this SDK version types only flat values
        await loops.sendTransactionalEmail({
          transactionalId,
          email,
          dataVariables: dataVariables as unknown as Record<string, string | number>,
        });
      } catch (error) {
        logger.error('Release staff email failed', {
          email,
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    logger.error('Release staff email could not be built', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export default emailStaffOfRelease;
