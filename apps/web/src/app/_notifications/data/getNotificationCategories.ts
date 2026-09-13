import type { AccountKind } from '@/app/_auth/constants/accessProfiles';
import type { Notification } from '@/database/schema';

interface NotificationTypeInfo {
  type: Notification['type'];
  label: string;
  description: string;
}

interface NotificationCategory {
  id: string;
  label: string;
  /*
    Which accounts can actually receive these. A preference for something that
    can never fire is worse than no preference at all: it tells the account
    holder this platform does something for them that it does not, and buries
    the two switches that matter under fifteen that cannot.
  */
  appliesTo: AccountKind[];
  types: NotificationTypeInfo[];
}

const TRADE: AccountKind[] = ['admin', 'sales', 'distributor', 'wine_partner'];

const EVERYONE: AccountKind[] = [
  'admin',
  'warehouse',
  'wine_partner',
  'collector',
  'distributor',
  'sales',
];

const ALL_CATEGORIES: NotificationCategory[] = [
  {
    id: 'cellar',
    label: 'Your Cellar',
    appliesTo: ['collector', 'wine_partner', 'admin'],
    types: [
      {
        type: 'cellar_wine_received',
        label: 'Wine Received',
        description: 'When wine arrives into your cellar and is put away',
      },
    ],
  },
  {
    id: 'quotes',
    label: 'Quotes & Orders',
    appliesTo: TRADE,
    types: [
      {
        type: 'buy_request_submitted',
        label: 'Buy Request Submitted',
        description: 'When a customer submits a buy request',
      },
      {
        type: 'cc_review_started',
        label: 'Review Started',
        description: 'When your request is being reviewed',
      },
      {
        type: 'quote_confirmed',
        label: 'Quote Confirmed',
        description: 'When a quote is confirmed and ready',
      },
      {
        type: 'revision_requested',
        label: 'Revision Requested',
        description: 'When changes are requested on a quote',
      },
      {
        type: 'status_update',
        label: 'Status Updates',
        description: 'General order status changes',
      },
    ],
  },
  {
    id: 'purchase_orders',
    label: 'Purchase Orders',
    appliesTo: TRADE,
    types: [
      {
        type: 'po_submitted',
        label: 'PO Submitted',
        description: 'When a purchase order is submitted',
      },
      {
        type: 'po_confirmed',
        label: 'PO Confirmed',
        description: 'When a purchase order is confirmed',
      },
      {
        type: 'po_approved',
        label: 'PO Approved',
        description: 'When a purchase order is approved',
      },
      {
        type: 'po_assigned',
        label: 'PO Assigned',
        description: 'When a purchase order is assigned to you',
      },
      {
        type: 'order_delivered',
        label: 'Order Delivered',
        description: 'When an order is marked as delivered',
      },
    ],
  },
  {
    id: 'payments',
    label: 'Payments',
    appliesTo: TRADE,
    types: [
      {
        type: 'payment_received',
        label: 'Payment Received',
        description: 'When a payment is received',
      },
      {
        type: 'payment_proof_submitted',
        label: 'Payment Proof Submitted',
        description: 'When payment proof is submitted',
      },
    ],
  },
  {
    id: 'sourcing',
    label: 'Sourcing (RFQ)',
    appliesTo: ['admin', 'wine_partner'],
    types: [
      {
        type: 'rfq_received',
        label: 'RFQ Received',
        description: 'When you receive a request for quote',
      },
      {
        type: 'rfq_response_submitted',
        label: 'RFQ Response Submitted',
        description: 'When a partner submits a quote response',
      },
      {
        type: 'rfq_deadline_reminder',
        label: 'RFQ Deadline Reminder',
        description: 'Reminders about upcoming RFQ deadlines',
      },
      {
        type: 'rfq_quotes_selected',
        label: 'RFQ Quotes Selected',
        description: 'When quotes are selected from an RFQ',
      },
    ],
  },
  {
    id: 'logistics',
    label: 'Shipments & Documents',
    appliesTo: ['admin', 'wine_partner'],
    types: [
      {
        type: 'shipment_status_changed',
        label: 'Shipment Status',
        description: 'When a shipment moves to a new stage',
      },
      {
        type: 'document_expiring_soon',
        label: 'Document Expiring',
        description: 'Before a document on file lapses',
      },
      {
        type: 'document_expired',
        label: 'Document Expired',
        description: 'When a document on file has lapsed',
      },
    ],
  },
  {
    id: 'general',
    label: 'General',
    appliesTo: EVERYONE,
    types: [
      {
        type: 'action_required',
        label: 'Action Required',
        description: 'When your action is needed',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin & System',
    appliesTo: ['admin'],
    types: [
      {
        type: 'new_user_pending',
        label: 'New User Pending',
        description: 'When a new user is awaiting approval',
      },
    ],
  },
];

/**
 * Get notification categories, optionally narrowed to one kind of account
 *
 * Called with no argument it returns the whole catalogue, which is what the
 * "disable everything" admin tooling needs. Called with an account kind it
 * returns only what that account can receive.
 *
 * @example
 *   getNotificationCategories('collector'); // Your Cellar, General
 *
 * @param kind - Whose settings screen this is for
 * @returns The categories that account can act on
 */
const getNotificationCategories = (kind?: AccountKind): NotificationCategory[] =>
  kind
    ? ALL_CATEGORIES.filter((category) => category.appliesTo.includes(kind))
    : ALL_CATEGORIES;

/**
 * Get all notification types as a flat array
 */
const getAllNotificationTypes = () => {
  return getNotificationCategories().flatMap((category) =>
    category.types.map((t) => t.type),
  );
};

export { getAllNotificationTypes };
export default getNotificationCategories;
