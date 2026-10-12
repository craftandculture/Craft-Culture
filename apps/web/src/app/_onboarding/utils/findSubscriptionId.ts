/**
 * Find the subscription a Zoho Billing webhook is about
 *
 * Zoho's payloads differ by event — a subscription event carries the
 * subscription, a payment event carries an invoice listing it — so the id is
 * looked for in each place it can be. Nothing else in the payload is used:
 * the subscription is then read back from Zoho itself.
 *
 * @param payload - The webhook body
 * @returns The subscription id, or null
 */
const findSubscriptionId = (payload: unknown) => {
  const body = (payload ?? {}) as Record<string, unknown>;
  const data = (body.data ?? body) as Record<string, unknown>;

  const subscription = data.subscription as { subscription_id?: string } | undefined;
  if (subscription?.subscription_id) return subscription.subscription_id;

  const invoice = (data.invoice ?? (data.payment as Record<string, unknown> | undefined)) as
    | { subscriptions?: { subscription_id?: string }[]; invoices?: { subscription_ids?: string[] }[] }
    | undefined;
  const fromInvoice = invoice?.subscriptions?.[0]?.subscription_id ?? invoice?.invoices?.[0]?.subscription_ids?.[0];
  if (fromInvoice) return fromInvoice;

  return typeof data.subscription_id === 'string' ? data.subscription_id : null;
};

export default findSubscriptionId;
