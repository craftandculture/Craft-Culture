import type { OrderStatus } from './orderEmailTypes';

interface QueuedEmail {
  id: string;
  orderId: string;
  recipientEmail: string;
  event: string;
  isAction: boolean;
  sendAt: Date;
  createdAt: Date;
}

/**
 * Combine the emails due together into the ones actually sent
 *
 * Status emails to one address about one order are sent as one: a request to
 * act that is still open wins, otherwise the latest update does. A request to
 * act that the order has since moved past is dropped, so nobody is asked to do
 * something already done. Each note is sent on its own.
 *
 * @example
 *   // Approved, then assigned and awaiting the partner: one email, asking them to confirm the client
 *   groupOrderEmails(rows, (orderId) => 'awaiting_partner_verification');
 *
 * @param rows - The emails due, oldest first
 * @param statusOf - Each order's current status
 * @returns The email to send for each group, and the rows it replaces
 */
const groupOrderEmails = <T extends QueuedEmail>(rows: T[], statusOf: (orderId: string) => OrderStatus | null) => {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key =
      row.event === 'note_added'
        ? `note:${row.id}`
        : `${row.recipientEmail.trim().toLowerCase()}:${row.orderId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const result: { carrier: T | null; merged: T[] }[] = [];

  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) => a.sendAt.getTime() - b.sendAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const current = statusOf(sorted[0]!.orderId);
    const stillOpen = sorted.filter((row) => !row.isAction || row.event === current || row.event === 'note_added');

    const carrier = [...stillOpen].reverse().find((row) => row.isAction) ?? stillOpen[stillOpen.length - 1] ?? null;
    result.push({ carrier, merged: sorted.filter((row) => row !== carrier) });
  }

  return result;
};

export default groupOrderEmails;
