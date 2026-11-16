import { eq } from 'drizzle-orm';

import logisticsEmailTemplateId from '@/app/_logistics/utils/logisticsEmailTemplateId';
import db from '@/database/client';
import { cellarReleaseRequestItems, cellarReleaseRequests, partners } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

/** Who is emailed when a member's release needs the team: Sophie prices it, Laraine backs her up */
export const RELEASE_ALERT_EMAILS = ['sophie@craftculture.xyz', 'laraine@craftculture.xyz'];

/**
 * Email the team that a member's release request needs them
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
}: {
  requestId: string;
  event: 'submitted' | 'accepted';
  amended?: boolean;
}) => {
  try {
    const [request] = await db
      .select({
        number: cellarReleaseRequests.requestNumber,
        address: cellarReleaseRequests.deliveryAddress,
        memberNotes: cellarReleaseRequests.memberNotes,
        member: partners.businessName,
      })
      .from(cellarReleaseRequests)
      .innerJoin(partners, eq(partners.id, cellarReleaseRequests.partnerId))
      .where(eq(cellarReleaseRequests.id, requestId))
      .limit(1);

    if (!request) return;

    const items = await db
      .select({
        name: cellarReleaseRequestItems.productName,
        vintage: cellarReleaseRequestItems.vintage,
        caseConfig: cellarReleaseRequestItems.caseConfig,
        bottles: cellarReleaseRequestItems.bottles,
      })
      .from(cellarReleaseRequestItems)
      .where(eq(cellarReleaseRequestItems.requestId, requestId));

    const bottles = items.reduce((sum, item) => sum + (item.bottles ?? 0), 0);
    const link = `${serverConfig.appUrl}/platform/admin/cellar-releases`;

    const subject =
      event === 'accepted'
        ? `Release accepted: ${request.number} · ${request.member}. Prepare the delivery`
        : amended
          ? `Release changed: ${request.number} · ${request.member}. Re-check before quoting`
          : `New release request: ${request.number} · ${request.member}. Please price it`;

    const lines = [
      event === 'accepted'
        ? `${request.member} has accepted the delivery quote on ${request.number}. The order is raised: please raise the sales order and pick list, and book the delivery.`
        : amended
          ? `${request.member} has added wine to ${request.number}. Re-check it before the quote goes out.`
          : `${request.member} has asked for wine to be released from bond on ${request.number}. Please set the prices and send the quote.`,
      '',
      `${items.length} ${items.length === 1 ? 'wine' : 'wines'} · ${bottles} bottles`,
      ...items.map(
        (item) =>
          `• ${item.name}${item.vintage ? ` ${item.vintage}` : ' NV'} · ${item.bottles ?? 0} btl${
            item.caseConfig ? ` (${item.caseConfig}-pack)` : ''
          }`,
      ),
      '',
      request.address ? `Deliver to: ${request.address}` : 'No delivery address given',
      ...(request.memberNotes?.trim() ? [`Member's note: ${request.memberNotes.trim()}`] : []),
      '',
      `Open it in the Index: ${link}`,
    ];

    const transactionalId = logisticsEmailTemplateId();
    const dataVariables = {
      subject,
      // A blank line needs a value Loops will not collapse, as in sendLogisticsEmail
      lines: lines.map((text) => ({ text: text.trim() ? text : ' ' })),
    };

    for (const email of RELEASE_ALERT_EMAILS) {
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
