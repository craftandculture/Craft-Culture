import formatGulfDate from './formatGulfDate';
import orderEmailCopy from './orderEmailCopy';
import orderEmailProgress from './orderEmailProgress';
import type { OrderEmailAudience, OrderEmailEvent, OrderEmailLinks, OrderEmailSnapshot } from './orderEmailTypes';
import orderEmailWines from './orderEmailWines';


const usd = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

/**
 * The Loops data for one order email, or null when this party hears nothing
 *
 * @param event - What happened
 * @param audience - Who the email is for
 * @param order - The order as it stands now
 * @param links - The order screen and proforma for this audience
 * @param recipientName - How the greeting addresses them
 * @returns The orderUpdate template's variables, or null
 */
const buildOrderEmail = (
  event: OrderEmailEvent,
  audience: OrderEmailAudience,
  order: OrderEmailSnapshot,
  links: OrderEmailLinks,
  recipientName: string,
) => {
  const copy = orderEmailCopy(event, audience, order);
  if (!copy) return null;

  const rows: { label: string; value: string }[] = [{ label: 'Order', value: order.orderNumber }];
  if (order.clientName) rows.push({ label: 'Client', value: order.clientName });
  if (copy.clientContact && order.clientEmail) rows.push({ label: 'Email', value: order.clientEmail });
  if (copy.clientContact && order.clientPhone) rows.push({ label: 'Mobile', value: order.clientPhone });
  if (audience === 'partner' && order.distributorName) rows.push({ label: 'Distributor', value: order.distributorName });
  if (order.paymentReference) rows.push({ label: 'Payment reference', value: order.paymentReference });
  if (order.scheduledDeliveryDate && order.status !== 'delivered')
    rows.push({ label: 'Delivery date', value: formatGulfDate(order.scheduledDeliveryDate, 'long') });
  if (order.deliveredAt) rows.push({ label: 'Delivered on', value: formatGulfDate(order.deliveredAt, 'long') });
  if (order.totalUsd > 0) rows.push({ label: 'Order total', value: usd(order.totalUsd) });

  return {
    isAction: copy.isAction,
    data: {
      subject: copy.subject,
      preheader: copy.preheader,
      label: order.orderNumber,
      eyebrow: copy.eyebrow,
      headline: copy.headline,
      name: recipientName,
      body: copy.body,
      note: copy.note?.text?.trim() ? [{ title: copy.note.title, text: copy.note.text.trim() }] : [],
      action: copy.action ? [{ text: copy.action }] : [],
      ctaLabel: copy.ctaLabel,
      ctaUrl: links.orderUrl,
      secondary: copy.proforma ? [{ label: 'Download the proforma invoice', url: links.proformaUrl }] : [],
      steps: orderEmailProgress(order, audience),
      ...orderEmailWines(order),
      rows,
    },
  };
};

export default buildOrderEmail;
