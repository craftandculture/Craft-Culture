import type { TransactionalVariables } from 'loops';

import { ORDER_EMAIL_TEMPLATE_ID } from '@/app/_privateClientOrders/constants';
import { ORDER_EMAIL_SHADOW_INBOX } from '@/app/_privateClientOrders/data/getOrderEmailMode';
import loops from '@/lib/loops/client';

import type { WarehouseEmailData } from '../types';

/**
 * Send one warehouse update to a distributor's people, or in shadow one copy
 * to Kevin naming who it was for
 *
 * Live: each person gets their own copy, greeted by name. Shadow: Kevin gets
 * one, "[SHADOW for …]" before the subject.
 *
 * @param build - The email for a given greeting name
 * @param recipients - Who it is for
 * @param mode - Shadow or live
 * @returns How it went, for the rows it carries
 */
const deliverWarehouseEmail = async (
  build: (name: string) => WarehouseEmailData,
  recipients: { email: string; name: string }[],
  mode: 'shadow' | 'live',
) => {
  if (recipients.length === 0) return { status: 'failed' as const, sentTo: null, error: 'No recipient: add a Logistics or Purchasing contact, or a business email' };

  try {
    if (mode === 'shadow') {
      const names = recipients.map((r) => `${r.name} <${r.email}>`);
      const shadowFor = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ');
      const data = build(recipients[0]!.name);
      await loops.sendTransactionalEmail({
        transactionalId: ORDER_EMAIL_TEMPLATE_ID,
        email: ORDER_EMAIL_SHADOW_INBOX,
        dataVariables: { ...data, subject: `[SHADOW for ${shadowFor}] ${data.subject}` } as unknown as TransactionalVariables,
      });
      return { status: 'shadowed' as const, sentTo: ORDER_EMAIL_SHADOW_INBOX, error: null };
    }

    for (const recipient of recipients) {
      await loops.sendTransactionalEmail({
        transactionalId: ORDER_EMAIL_TEMPLATE_ID,
        email: recipient.email,
        dataVariables: build(recipient.name) as unknown as TransactionalVariables,
      });
    }
    return { status: 'sent' as const, sentTo: recipients.map((r) => r.email).join(', '), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'failed' as const, sentTo: null, error: message.slice(0, 1000) };
  }
};

export default deliverWarehouseEmail;
