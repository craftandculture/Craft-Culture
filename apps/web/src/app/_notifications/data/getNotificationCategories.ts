import type { Notification } from '@/database/schema';

interface NotificationTypeInfo {
  type: Notification['type'];
  label: string;
  description: string;
}

interface NotificationCategory {
  id: string;
  label: string;
  types: NotificationTypeInfo[];
}

/**
 * Get notification types organized by category for UI display
 *
 * @returns Array of categories with their notification types
 */
const getNotificationCategories = (): NotificationCategory[] => [
  {
    id: 'quotes',
    label: 'Quotes & Orders',
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
    id: 'admin',
    label: 'Admin & System',
    types: [
      {
        type: 'new_user_pending',
        label: 'New User Pending',
        description: 'When a new user is awaiting approval',
      },
      {
        type: 'action_required',
        label: 'Action Required',
        description: 'When your action is needed',
      },
    ],
  },
];

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
