import type { CellarReleaseDeliveryDetails } from '@/database/schema';

import describePreferredDelivery from './describePreferredDelivery';

/**
 * The delivery notes carried onto the order raised from a member's request
 *
 * Everyone downstream — the warehouse, the distributor, the driver — reads the
 * order, not the request, so the member's preferences and any gift have to
 * travel on it in words.
 *
 * @example
 *   buildReleaseDeliveryNotes({ memberNotes: 'Ring first', details, memberName: 'Ihab Toma' });
 *
 * @param memberNotes - What the member wrote for our team
 * @param details - The member's delivery choices, if any were recorded
 * @param memberName - The cellar member, named on a gift
 * @returns The notes, or null when there is nothing to say
 */
const buildReleaseDeliveryNotes = ({
  memberNotes,
  details,
  memberName,
}: {
  memberNotes: string | null;
  details: CellarReleaseDeliveryDetails | undefined;
  memberName: string;
}) => {
  const lines: string[] = [];

  const preferred = describePreferredDelivery(
    details?.preferredDate,
    details?.preferredWindow,
  );

  if (preferred) {
    lines.push(`Member's preferred delivery: ${preferred} (to be confirmed).`);
  }

  if (details?.deliveryInstructions) {
    lines.push(`Access: ${details.deliveryInstructions}`);
  }

  if (details?.isGift) {
    lines.push(
      `GIFT from ${memberName} to ${details.recipientName ?? 'recipient'}` +
        `${details.recipientPhone ? ` (${details.recipientPhone})` : ''}.` +
        ' Recipient must be 21 or over; check ID on delivery.',
    );

    if (details.giftMessage) {
      lines.push(`Gift message: "${details.giftMessage}"`);
    }
  }

  if (memberNotes?.trim()) lines.push(`Member notes: ${memberNotes.trim()}`);

  return lines.length > 0 ? lines.join('\n') : null;
};

export default buildReleaseDeliveryNotes;
