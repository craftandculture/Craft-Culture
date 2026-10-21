import loops from '@/lib/loops/client';

import logisticsEmailTemplateId from './logisticsEmailTemplateId';

/**
 * Send one email from logistics@ through Loops
 *
 * The body goes line by line into the template's repeating block, so the email
 * keeps its lines and lists without any HTML being sent. The template sends
 * from logistics@ and replies go back to it, so the team sees them.
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
