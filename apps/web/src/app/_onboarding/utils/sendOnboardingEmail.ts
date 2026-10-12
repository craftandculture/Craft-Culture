import loops from '@/lib/loops/client';
import logger from '@/utils/logger';

import loopsTemplates from '../constants/loopsTemplates';
import type { OnboardingEmail } from '../constants/loopsTemplates';

/**
 * Send one of the onboarding emails, if its template exists yet
 *
 * Templates are built in Loops by hand. Until one has an id, the send is
 * skipped and logged rather than failing — a missing email must never stop a
 * sign-up, an approval or an invite going through.
 *
 * @param email - Which onboarding email
 * @param to - Recipient address
 * @param dataVariables - The template's variables
 * @returns True if it was handed to Loops
 */
const sendOnboardingEmail = async (
  email: OnboardingEmail,
  to: string,
  dataVariables: Record<string, string>,
) => {
  const transactionalId = loopsTemplates[email];

  if (!transactionalId) {
    logger.warn(`Onboarding email "${email}" skipped — no Loops template id yet`, {
      to,
    });
    return false;
  }

  try {
    await loops.sendTransactionalEmail({ transactionalId, email: to, dataVariables });
    return true;
  } catch (error) {
    logger.error(`Onboarding email "${email}" failed`, { error, to });
    return false;
  }
};

export default sendOnboardingEmail;
