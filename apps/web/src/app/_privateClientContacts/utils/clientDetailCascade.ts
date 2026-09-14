import type { privateClientOrderStatus } from '@/database/schema';

type OrderStatus = (typeof privateClientOrderStatus.enumValues)[number];

/** The client details an order keeps its own copy of. */
export interface ClientDetailInput {
  name?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
}

export interface OrderClientPatch {
  clientName?: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
}

/**
 * An order that has been delivered or cancelled is a record of what happened.
 *
 * Its client details were true when it shipped, and rewriting them turns a
 * delivery note and an invoice into a disagreement with the order behind them.
 */
const CLOSED_STATUSES: OrderStatus[] = ['delivered', 'cancelled'];

/** Orders still in flight, whose client details are still operational. */
export const OPEN_ORDER_STATUSES = (
  [
    'draft',
    'submitted',
    'under_cc_review',
    'revision_requested',
    'cc_approved',
    'awaiting_partner_verification',
    'awaiting_distributor_verification',
    'verification_suspended',
    'awaiting_client_payment',
    'awaiting_payment_verification',
    'client_paid',
    'awaiting_distributor_payment',
    'distributor_paid',
    'awaiting_partner_payment',
    'partner_paid',
    'scheduling_delivery',
    'delivery_scheduled',
    'stock_in_transit',
    'with_distributor',
    'out_for_delivery',
  ] as OrderStatus[]
).filter((status) => !CLOSED_STATUSES.includes(status));

/** One line, as an order stores an address. */
const joinAddress = (input: ClientDetailInput) =>
  [
    input.addressLine1,
    input.addressLine2,
    input.city,
    input.stateProvince,
    input.postalCode,
    input.country,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');

/**
 * Work out what a client edit changes on the orders that copied those details.
 *
 * `private_client_orders` holds its own `clientName`/`clientEmail`/
 * `clientPhone`/`clientAddress`, taken at submission. Two places therefore
 * answer "what is this client's phone number", and the distributor portal reads
 * the order's copy — so a client record corrected on its own leaves the people
 * doing the delivery looking at the old number.
 *
 * Only fields actually supplied are returned, so an edit to a name cannot blank
 * an address that was not part of it. An empty string is a deliberate clearing
 * and becomes null; `undefined` means "not edited" and is left alone.
 *
 * Address is included deliberately — it was previously left out of the cascade,
 * so an order's address silently diverged from the client's the first time
 * someone moved.
 *
 * @example
 *   buildOrderClientPatch({ phone: '+971 56 111 5666' });
 *   // { clientPhone: '+971 56 111 5666' }
 *
 * @param input - The edited client fields
 * @returns The patch to apply to that client's open orders, empty if none apply
 */
const buildOrderClientPatch = (input: ClientDetailInput): OrderClientPatch => {
  const patch: OrderClientPatch = {};

  if (input.name !== undefined) patch.clientName = input.name;
  if (input.email !== undefined) patch.clientEmail = input.email || null;
  if (input.phone !== undefined) patch.clientPhone = input.phone || null;

  // Any address part changing rewrites the order's single address line, which
  // is assembled from all of them.
  const addressTouched = [
    input.addressLine1,
    input.addressLine2,
    input.city,
    input.stateProvince,
    input.postalCode,
    input.country,
  ].some((part) => part !== undefined);

  if (addressTouched) patch.clientAddress = joinAddress(input) || null;

  return patch;
};

export default buildOrderClientPatch;
