import { MEMBER_EMAIL_LIST_CAP } from '../constants/memberEmailEvents';

export interface DueMemberEmail {
  id: string;
  recipientUserId: string | null;
  recipientEmail: string;
  kind: string;
  sendAt: Date;
  isMergeable: boolean;
  data: Record<string, unknown>;
}

export interface MemberEmailToSend {
  /** The row the email is sent and recorded against */
  carrierId: string;
  /** Rows folded into it, marked merged once it has gone */
  mergedIds: string[];
  recipientEmail: string;
  data: Record<string, unknown>;
}

interface WineRow {
  name: string;
  detail: string;
  quantity: string;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Cap a wine list at eight and say what is left, so a long delivery still
 * reads on a phone; the full list is always in the cellar
 *
 * `_bottles` (the total, kept with the row) gives the heading; keys starting
 * with an underscore are bookkeeping and never reach Loops.
 *
 * @param data - The email's variables
 * @returns The variables Loops receives
 */
export const finishEmailData = (data: Record<string, unknown>) => {
  const finished: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith('_')) finished[key] = value;
  }

  const wines = Array.isArray(data.wines) ? (data.wines as WineRow[]) : null;
  if (wines) {
    const bottles = typeof data._bottles === 'number' ? data._bottles : null;
    finished.listTitle = bottles
      ? `${plural(wines.length, 'wine')} · ${plural(bottles, 'bottle')}`
      : plural(wines.length, 'wine');
    finished.wines = wines.slice(0, MEMBER_EMAIL_LIST_CAP);
    const more = wines.length - MEMBER_EMAIL_LIST_CAP;
    finished.listMore =
      more > 0 ? `And ${plural(more, 'more wine')}. The full list is in your cellar.` : '';
  }

  return finished;
};

/**
 * Fold due mergeable updates of the same kind, for the same member at the
 * same slot, into one email
 *
 * The first queued row carries the email and its wording; the wine lists of
 * the others are added to it, and their bottle counts summed. Everything
 * else goes as it is.
 *
 * @param due - Rows due now, oldest first
 * @returns The emails to send
 */
const mergeMemberEmails = (due: DueMemberEmail[]): MemberEmailToSend[] => {
  const emails: MemberEmailToSend[] = [];
  const byGroup = new Map<string, MemberEmailToSend>();

  for (const row of due) {
    const group = row.isMergeable ? `${row.recipientEmail}|${row.kind}|${row.sendAt.getTime()}` : null;
    const twin = group ? byGroup.get(group) : undefined;

    if (twin) {
      const wines = [...((twin.data.wines as WineRow[]) ?? []), ...((row.data.wines as WineRow[]) ?? [])];
      const bottles =
        (typeof twin.data._bottles === 'number' ? twin.data._bottles : 0) +
        (typeof row.data._bottles === 'number' ? row.data._bottles : 0);
      twin.data = { ...twin.data, wines, _bottles: bottles || undefined };
      twin.mergedIds.push(row.id);
      continue;
    }

    const email = { carrierId: row.id, mergedIds: [], recipientEmail: row.recipientEmail, data: { ...row.data } };
    emails.push(email);
    if (group) byGroup.set(group, email);
  }

  return emails.map((email) => ({ ...email, data: finishEmailData(email.data) }));
};

export default mergeMemberEmails;
