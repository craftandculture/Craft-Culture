import { LOGISTICS_EMAIL } from '@/lib/company';
import loops from '@/lib/loops/client';
import logger from '@/utils/logger';

import logisticsEmailTemplateId from './logisticsEmailTemplateId';

/**
 * Send one email from logistics@ through Loops
 *
 * The body goes line by line into the template's repeating block, so the email
 * keeps its lines and lists without any HTML being sent. The template sends
 * from logistics@ and replies go back to it, so the team sees them.
 *
 * Loops sends to one address and has no Cc, so every email that goes out is
 * also sent to logistics@ as a copy, headed with who it went to. The mailbox
 * then holds what was sent as well as the replies. A failed copy is logged and
 * never fails the send itself.
 *
 * @example
 *   await sendLogisticsEmail({ to: 'ops@forwarder.com', subject, body });
 *
 * @param email - One recipient, the subject and the plain-text body
 * @returns Whether Loops accepted it, and why not
 */
const sendLogisticsEmail = async (email: {
  to: string;
  subject: string;
  body: string;
}) => {
  const transactionalId = logisticsEmailTemplateId();

  if (!transactionalId) {
    return {
      ok: false as const,
      error: 'No Loops template is set for logistics emails',
    };
  }

  try {
    const dataVariables = {
      subject: email.subject,
      // A blank line needs a value Loops will not collapse: a plain space drops the break, a no-break space keeps it
      lines: email.body
        .split('\n')
        .map((text) => ({ text: text.trim() ? text : '\u00a0' })),
    };

    // The Loops API takes arrays of objects for repeating blocks; this SDK version types only flat values
    await loops.sendTransactionalEmail({
      transactionalId,
      email: email.to,
      dataVariables: dataVariables as unknown as Record<
        string,
        string | number
      >,
    });

    if (email.to.trim().toLowerCase() !== LOGISTICS_EMAIL) {
      try {
        await loops.sendTransactionalEmail({
          transactionalId,
          email: LOGISTICS_EMAIL,
          dataVariables: {
            subject: email.subject,
            lines: [
              { text: `Copy for logistics@: this email was sent to ${email.to}` },
              { text: '\u00a0' },
              ...dataVariables.lines,
            ],
          } as unknown as Record<string, string | number>,
        });
      } catch (copyError) {
        logger.error('Logistics email: copy to logistics@ failed', {
          to: email.to,
          error: copyError instanceof Error ? copyError.message : String(copyError),
        });
      }
    }

    return { ok: true as const, error: null };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : 'The email could not be sent',
    };
  }
};

export default sendLogisticsEmail;
