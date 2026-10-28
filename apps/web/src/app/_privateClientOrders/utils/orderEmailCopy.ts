import formatGulfDate from './formatGulfDate';
import type { OrderEmailAudience, OrderEmailCopy, OrderEmailEvent, OrderEmailSnapshot } from './orderEmailTypes';

/*
  The one definition of what a wine partner or a distributor hears about an
  order by email, and how it reads.

  Every order email uses one Loops template (orderUpdate). The copy, the
  progress tracker, the wines and the details are written here and sent as
  data, so changing a sentence is a code change, reviewed like any other,
  rather than an edit in Loops. Loops has no conditionals, so an optional
  block (the next-step box, a note, the proforma link) is a list of zero or
  one items: an empty list draws nothing.

  Three rules shape the schedule:
  - Each party hears only the moments that matter to them: when they must act,
    and the milestones they would otherwise ask about. Everything else stays in
    the order timeline.
  - Nobody is emailed about what they just did themselves (the queue skips the
    party that caused the event).
  - Events that land together become one email describing where the order now
    stands (sendOrderEmails), and a request to act that has since been done is
    dropped.
*/

/**
 * What one event says to one party, or null when that party hears nothing
 *
 * @param event - The activity-log row
 * @param audience - Who the email is for
 * @param order - The order as it stands
 * @returns The copy, or null
 */
const orderEmailCopy = (
  event: OrderEmailEvent,
  audience: OrderEmailAudience,
  order: OrderEmailSnapshot,
): OrderEmailCopy | null => {
  const n = order.orderNumber;
  const client = order.clientName || 'your client';
  const dist = order.distributorName || 'the distributor';
  const ref = order.paymentReference || n;

  if (event.action === 'note_added') {
    const from = event.authorParty || 'Craft & Culture';
    return {
      isAction: false,
      subject: `New note on ${n} from ${from}`,
      preheader: (event.notes ?? '').slice(0, 120),
      eyebrow: 'New note',
      headline: `A note from ${from}`,
      body: `${event.authorName || from} has added a note to this order. You can reply on the order, where everyone involved can see it.`,
      note: { title: 'Note', text: event.notes },
      ctaLabel: 'Reply on the order',
    };
  }

  const status = event.newStatus;
  if (!status || status === event.previousStatus) return null;

  if (audience === 'partner') {
    switch (status) {
      case 'revision_requested':
        return {
          isAction: true,
          subject: `Changes needed on ${n}`,
          preheader: 'Please review our note and submit the order again.',
          eyebrow: 'Changes requested',
          headline: 'Your order needs a few changes',
          body: `We have reviewed this order for ${client} and need a few changes before we can approve it.`,
          note: { title: 'Our note', text: order.revisionReason ?? event.notes },
          action: 'Update the order and submit it again.',
          ctaLabel: 'Update the order',
        };
      case 'cc_approved':
        return {
          isAction: false,
          subject: `${n} has been approved`,
          preheader: 'We are now assigning a distributor to deliver your order.',
          eyebrow: 'Order approved',
          headline: 'Your order has been approved',
          body: `We have approved this order for ${client}. We are now assigning the distributor who will deliver it, and will be in touch at the next step.`,
          ctaLabel: 'View the order',
        };
      case 'awaiting_partner_verification':
        return {
          isAction: true,
          subject: `Please confirm your client for ${n}`,
          preheader: `Please confirm whether ${client} is registered with ${dist}.`,
          eyebrow: 'Action required',
          headline: 'Please confirm your client',
          body: `Your order has been approved and assigned to ${dist}, who will deliver it. Before payment can be arranged, please confirm whether ${client} is already registered with them.`,
          action: `Confirm whether ${client} is registered with ${dist}.`,
          ctaLabel: 'Confirm your client',
        };
      case 'verification_suspended':
        return {
          isAction: true,
          subject: `${n} is on hold: client not verified`,
          preheader: `${dist} could not verify ${client}.`,
          eyebrow: 'Action required',
          headline: 'Your client could not be verified',
          body: `${dist} was unable to verify ${client} for this order, so it is on hold until this is resolved.`,
          note: { title: `Notes from ${dist}`, text: order.distributorVerificationNotes ?? event.notes },
          action: `Resolve the matter with ${client}, then send the order back for verification.`,
          ctaLabel: 'Review the order',
        };
      case 'awaiting_client_payment':
        return {
          isAction: false,
          subject: `${client} verified for ${n}`,
          preheader: `${dist} will now collect payment from your client.`,
          eyebrow: 'Client verified',
          headline: 'Your client has been verified',
          body: `${dist} has verified ${client} and will now collect payment, quoting the reference ${ref}.`,
          ctaLabel: 'View the order',
        };
      case 'client_paid':
        return {
          isAction: false,
          subject: `Payment received for ${n}`,
          preheader: 'We are now preparing the wine for dispatch.',
          eyebrow: 'Payment received',
          headline: 'Your client has paid',
          body: `${dist} has confirmed payment from ${client}. We are now preparing the wine for dispatch from our bonded warehouse.`,
          ctaLabel: 'View the order',
        };
      case 'stock_in_transit':
        return {
          isAction: false,
          subject: `${n} has been dispatched`,
          preheader: `The wine is on its way to ${dist}.`,
          eyebrow: 'Dispatched',
          headline: 'Your order is on its way',
          body: `The wine has left our bonded warehouse and is on its way to ${dist}, who will then arrange delivery with ${client}.`,
          ctaLabel: 'View the order',
        };
      case 'with_distributor':
        return {
          isAction: false,
          subject: `${n} has reached ${dist}`,
          preheader: `${dist} will now arrange delivery with your client.`,
          eyebrow: 'With the distributor',
          headline: 'Your order has reached the distributor',
          body: `The wine has arrived with ${dist}, who will now contact ${client} to arrange delivery.`,
          ctaLabel: 'View the order',
        };
      case 'delivery_scheduled':
        return {
          isAction: false,
          subject: `Delivery scheduled for ${n}`,
          preheader: order.scheduledDeliveryDate
            ? `Delivery to ${client} on ${formatGulfDate(order.scheduledDeliveryDate, 'long')}.`
            : `${dist} has agreed a delivery date with your client.`,
          eyebrow: 'Delivery',
          headline: 'Delivery has been scheduled',
          body: order.scheduledDeliveryDate
            ? `${dist} will deliver this order to ${client} on ${formatGulfDate(order.scheduledDeliveryDate, 'long')}.`
            : `${dist} has agreed a delivery date with ${client}.`,
          ctaLabel: 'View the order',
        };
      case 'delivered':
        return {
          isAction: false,
          subject: `${n} has been delivered`,
          preheader: `Your order has been delivered to ${client}.`,
          eyebrow: 'Delivered',
          headline: 'Your order has been delivered',
          body: `${dist} has delivered this order to ${client}${order.deliveredAt ? ` on ${formatGulfDate(order.deliveredAt, 'long')}` : ''}. Thank you for your business.`,
          ctaLabel: 'View the order',
        };
      case 'partner_paid':
        return {
          isAction: false,
          subject: `Payment sent for ${n}`,
          preheader: 'We have recorded our payment to you for this order.',
          eyebrow: 'Payment sent',
          headline: 'We have paid you for this order',
          body: `We have recorded our payment to you for this order. Please allow the usual time for the bank transfer to reach your account.`,
          ctaLabel: 'View the order',
        };
      case 'cancelled':
        return {
          isAction: false,
          subject: `${n} has been cancelled`,
          preheader: `The order for ${client} has been cancelled.`,
          eyebrow: 'Cancelled',
          headline: 'This order has been cancelled',
          body: `The order for ${client} has been cancelled. No further action is needed.`,
          note: { title: 'Reason', text: order.cancellationReason ?? event.notes },
          ctaLabel: 'View the order',
        };
      default:
        return null;
    }
  }

  switch (status) {
    case 'awaiting_distributor_verification':
      return {
        isAction: true,
        subject: `New order ${n}: please verify the client`,
        preheader: `Please check whether ${client} is registered with you.`,
        eyebrow: 'New order',
        headline: 'Please verify this client',
        body: `Craft & Culture has assigned you a new private client order. Before payment is collected, please check whether ${client} is registered with you.`,
        action: `Check whether ${client} is registered with you, then confirm on the order.`,
        ctaLabel: 'Verify the client',
        clientContact: true,
      };
    case 'awaiting_client_payment': {
      const isNew = !event.previousStatus || ['cc_approved', 'under_cc_review', 'submitted'].includes(event.previousStatus);
      return {
        isAction: true,
        subject: isNew ? `New order ${n}: please collect payment` : `${n}: please collect payment`,
        preheader: `Please collect payment from ${client}, quoting ${ref}.`,
        eyebrow: isNew ? 'New order' : 'Payment',
        headline: isNew ? 'A new order has been assigned to you' : 'Please collect payment',
        body: isNew
          ? `Craft & Culture has assigned you a new private client order for ${client}. The proforma invoice is ready to download.`
          : `${client} is verified for this order. Please collect payment, quoting the reference below.`,
        action: `Collect payment from ${client}, quoting reference ${ref}.`,
        ctaLabel: 'View the order',
        proforma: true,
        clientContact: true,
      };
    }
    case 'awaiting_payment_verification':
      return {
        isAction: true,
        subject: `${n}: please confirm payment`,
        preheader: 'Please confirm the payment on the order once it has reached you.',
        eyebrow: 'Payment',
        headline: 'Please confirm the payment',
        body: `Payment for this order has been reported. Please check that it has reached you, then confirm it on the order so the wine can be dispatched.`,
        action: 'Confirm the payment on the order once it has been received.',
        ctaLabel: 'Confirm payment',
      };
    case 'stock_in_transit':
      return {
        isAction: true,
        subject: `${n} is on its way to you`,
        preheader: 'The wine has left our bonded warehouse.',
        eyebrow: 'Dispatched',
        headline: 'The wine is on its way to you',
        body: `The wine for this order has left our bonded warehouse and is on its way to you.`,
        action: 'Confirm receipt on the order when the wine arrives.',
        ctaLabel: 'View the order',
      };
    case 'cancelled':
      return {
        isAction: false,
        subject: `${n} has been cancelled`,
        preheader: `The order for ${client} has been cancelled.`,
        eyebrow: 'Cancelled',
        headline: 'This order has been cancelled',
        body: `The order for ${client} has been cancelled. Please do not collect payment or arrange delivery.`,
        note: { title: 'Reason', text: order.cancellationReason ?? event.notes },
        ctaLabel: 'View the order',
      };
    default:
      return null;
  }
};

export default orderEmailCopy;
