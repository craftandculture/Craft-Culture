import db from '@/database/client';
import { emailLog } from '@/database/schema';
import logger from '@/utils/logger';

/** Data variables that name what an email is about, in order of preference */
const REFERENCE_KEYS = ['label', 'orderNumber', 'reference', 'shipmentNumber', 'jobNumber', 'saleNumber', 'statementNumber'];

/** Data variables that say what an email is, when it has no subject of its own */
const TITLE_KEYS = ['subject', 'headline', 'title', 'preheader'];

const firstText = (data: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

/**
 * Record one email handed to Loops, for the Sent Emails feed
 *
 * Keeps the address, the subject and a reference only: the email's data is
 * never stored, as a sign-in email carries a one-time link. Never throws, so
 * a logging failure cannot stop an email or fail the request that sent it.
 *
 * @param params - What was sent to Loops
 * @param error - Why it failed, or null when Loops took it
 */
const logEmailSend = async (
  params: { transactionalId: string; email: string; dataVariables?: Record<string, unknown> },
  error: string | null,
) => {
  try {
    const data = (params.dataVariables ?? {}) as Record<string, unknown>;
    // A shadow copy is marked in its subject, or in its preview line when the template's subject is fixed
    const marked = ['subject', 'preheader']
      .map((key) => data[key])
      .find((value): value is string => typeof value === 'string' && value.startsWith('[SHADOW for '));
    const shadowFor = marked?.match(/^\[SHADOW for (.+?)\]/)?.[1] ?? null;
    const title = firstText(data, TITLE_KEYS)?.replace(/^\[SHADOW for .+?\]\s*/, '') || null;

    await db.insert(emailLog).values({
      transactionalId: params.transactionalId,
      toEmail: params.email,
      subject: title?.slice(0, 300) ?? null,
      shadowFor: shadowFor?.slice(0, 300) ?? null,
      reference: firstText(data, REFERENCE_KEYS)?.slice(0, 100) ?? null,
      ok: !error,
      error: error?.slice(0, 1000) ?? null,
    });
  } catch (logError) {
    logger.warn('Could not log an email send', {
      error: logError instanceof Error ? logError.message : String(logError),
    });
  }
};

export default logEmailSend;
