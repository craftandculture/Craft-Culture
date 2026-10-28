/* Shapes shared by the order email builder and the order-emails cron */

export type OrderEmailAudience = 'partner' | 'distributor';

export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'under_cc_review'
  | 'revision_requested'
  | 'cc_approved'
  | 'awaiting_partner_verification'
  | 'awaiting_distributor_verification'
  | 'verification_suspended'
  | 'awaiting_client_payment'
  | 'awaiting_payment_verification'
  | 'client_paid'
  | 'awaiting_distributor_payment'
  | 'distributor_paid'
  | 'awaiting_partner_payment'
  | 'partner_paid'
  | 'scheduling_delivery'
  | 'delivery_scheduled'
  | 'stock_in_transit'
  | 'with_distributor'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

/** One activity-log row, as the email needs it */
export interface OrderEmailEvent {
  /** 'note_added' for a shared note; anything else is a status change */
  action: string;
  newStatus: OrderStatus | null;
  previousStatus: OrderStatus | null;
  notes: string | null;
  /** Who wrote a note, and for which side */
  authorName?: string | null;
  authorParty?: string | null;
  at: Date;
}

/** The order as it stands when the email is written */
export interface OrderEmailSnapshot {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  distributorName: string | null;
  paymentReference: string | null;
  totalUsd: number;
  scheduledDeliveryDate: Date | null;
  deliveredAt: Date | null;
  revisionReason: string | null;
  cancellationReason: string | null;
  distributorVerificationNotes: string | null;
  items: {
    productName: string;
    vintage: string | null;
    region: string | null;
    bottleSize: string | null;
    caseConfig: number | null;
    quantity: number;
  }[];
  /** Every status the order has entered, with when: from its activity log */
  history: { status: OrderStatus; at: Date }[];
}

export interface OrderEmailLinks {
  /** The order screen for this audience */
  orderUrl: string;
  /** The distributor's proforma invoice */
  proformaUrl: string;
}

/** What one event says to one party */
export interface OrderEmailCopy {
  isAction: boolean;
  subject: string;
  preheader: string;
  eyebrow: string;
  headline: string;
  body: string;
  /** The next step, in one sentence, when the email asks for one */
  action?: string;
  note?: { title: string; text: string | null };
  ctaLabel: string;
  /** Show the proforma invoice link under the button */
  proforma?: boolean;
  /** Show the client's email and mobile in the details */
  clientContact?: boolean;
}
