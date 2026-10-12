/**
 * Zoho Billing API
 *
 * The Private Cellar membership: a monthly subscription paid by card. The card
 * is taken on Zoho's own hosted page, so no card detail ever reaches us. Zoho
 * Billing shares customers with Books on the same organisation, so a member
 * already invoiced in Books is reused rather than created twice.
 *
 * Needs the `ZohoSubscriptions.fullaccess.all` scope on the refresh token.
 */

import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import { getAccessToken, getZohoUrls, isZohoConfigured } from './client';

export interface ZohoBillingSubscription {
  subscription_id: string;
  customer_id: string;
  status: string;
  next_billing_at?: string;
  current_term_ends_at?: string;
  card?: { last_four_digits?: string };
  reference_id?: string;
}

interface ZohoHostedPage {
  hostedpage_id: string;
  url: string;
  status?: string;
  data?: { subscription?: ZohoBillingSubscription };
}

/** Whether Billing can be called at all */
const isBillingConfigured = () => isZohoConfigured();

const billingFetch = async <T>(endpoint: string, options: RequestInit = {}) => {
  if (!isBillingConfigured()) throw new Error('Zoho integration not configured');

  const token = await getAccessToken();
  const apiUrl = getZohoUrls()!.api.replace('/books/v3', '/billing/v1');
  const orgId = (serverConfig.zohoBillingOrganizationId ?? serverConfig.zohoOrganizationId ?? '').replace(
    /\s/g,
    '',
  );

  const response = await fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Zoho-oauthtoken ${token}`,
      'X-com-zoho-subscriptions-organizationid': orgId,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Zoho Billing API error', { endpoint, status: response.status, error: errorText });
    throw new Error(`Zoho Billing error: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<T>;
};

/**
 * The Billing customer for an email — the Books contact if there is one
 *
 * @returns The customer id
 */
const findOrCreateBillingCustomer = async ({
  email,
  name,
  phone,
}: {
  email: string;
  name: string;
  phone?: string | null;
}) => {
  const found = await billingFetch<{ customers: { customer_id: string; email: string }[] }>(
    `/customers?email=${encodeURIComponent(email)}`,
  );
  const match = found.customers?.find((customer) => customer.email?.toLowerCase() === email.toLowerCase());
  if (match) return match.customer_id;

  const created = await billingFetch<{ customer: { customer_id: string } }>('/customers', {
    method: 'POST',
    body: JSON.stringify({ display_name: name, email, ...(phone && { mobile: phone }) }),
  });

  return created.customer.customer_id;
};

/**
 * Zoho's hosted page to start the membership: card in, subscription created
 *
 * @param params.referenceId - Our membership id, carried through to the subscription
 */
const createSubscriptionHostedPage = async ({
  customerId,
  redirectUrl,
  referenceId,
}: {
  customerId: string;
  redirectUrl: string;
  referenceId: string;
}) => {
  const result = await billingFetch<{ hostedpage: ZohoHostedPage }>('/hostedpages/newsubscription', {
    method: 'POST',
    body: JSON.stringify({
      customer_id: customerId,
      plan: { plan_code: serverConfig.zohoBillingPlanCode },
      redirect_url: redirectUrl,
      reference_id: referenceId,
    }),
  });

  return { hostedPageId: result.hostedpage.hostedpage_id, url: result.hostedpage.url };
};

/** Zoho's hosted page for a member to replace a failing card */
const createUpdateCardHostedPage = async ({
  subscriptionId,
  redirectUrl,
}: {
  subscriptionId: string;
  redirectUrl: string;
}) => {
  const result = await billingFetch<{ hostedpage: ZohoHostedPage }>('/hostedpages/updatecard', {
    method: 'POST',
    body: JSON.stringify({ subscription_id: subscriptionId, redirect_url: redirectUrl }),
  });

  return { hostedPageId: result.hostedpage.hostedpage_id, url: result.hostedpage.url };
};

/** What a hosted page produced — the subscription, once the card went through */
const getHostedPage = async (hostedPageId: string) => {
  const result = await billingFetch<{ data?: { subscription?: ZohoBillingSubscription }; status?: string }>(
    `/hostedpages/${encodeURIComponent(hostedPageId)}`,
  );

  return { status: result.status ?? null, subscription: result.data?.subscription ?? null };
};

const getSubscription = async (subscriptionId: string) => {
  const result = await billingFetch<{ subscription: ZohoBillingSubscription }>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
  );

  return result.subscription;
};

/**
 * Set the extra-case add-on for the next renewal
 *
 * Applied at the end of the term, so it is charged with the next month's fee
 * rather than prorated now.
 */
const setExtraCaseQuantity = async (subscriptionId: string, quantity: number) => {
  await billingFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      plan: { plan_code: serverConfig.zohoBillingPlanCode },
      addons: quantity > 0 ? [{ addon_code: serverConfig.zohoBillingExtraCaseAddon, quantity }] : [],
      end_of_term: true,
    }),
  });
};

/**
 * Our membership status for a Zoho subscription status
 *
 * Zoho's dunning states (unpaid, past due) all mean the same thing to the
 * member: actions are paused until the card is fixed.
 */
const membershipStatusFromZoho = (status: string) => {
  if (['live', 'trial', 'non_renewing'].includes(status)) return 'active' as const;
  if (['unpaid', 'dunning', 'past_due'].includes(status)) return 'past_due' as const;
  if (['cancelled', 'expired'].includes(status)) return 'cancelled' as const;
  return 'pending_payment' as const;
};

export {
  createSubscriptionHostedPage,
  createUpdateCardHostedPage,
  findOrCreateBillingCustomer,
  getHostedPage,
  getSubscription,
  isBillingConfigured,
  membershipStatusFromZoho,
  setExtraCaseQuantity,
};
