/** An order as a warehouse update names it to the distributor */
export interface WarehouseUpdateOrder {
  orderId: string;
  /** SO number for a Zoho order, PCO number for a private client order */
  label: string;
  /** Invoice number and the order's own reference, when there are any */
  reference: string | null;
  /** The private client's name, on a private client order */
  client: string | null;
}

/** One wine on a pick list, as the email lists it */
export interface WarehouseUpdateLine {
  name: string;
  quantity: string;
}

/** What one warehouse update row holds, whatever its kind */
export interface WarehouseUpdateData {
  orders: WarehouseUpdateOrder[];
  lines?: WarehouseUpdateLine[];
  cases?: number;
  bottles?: number;
  pickListNumber?: string;
  batchNumber?: string;
  /** Staged means ready to go; dispatched means it has already left */
  stage?: 'staged' | 'dispatched';
  deliveryNoteNumber?: string | null;
  deliveryNoteUrl?: string | null;
  problem?: 'cancelled' | 'changed';
}

/** How one distributor receives warehouse updates */
export interface WarehouseUpdatePrefs {
  /** Picked & packed: grouped at 11:00 and 16:00 Gulf time, or straight away */
  picked: 'grouped' | 'immediate';
  /** The 17:00 end-of-day summary */
  summary: boolean;
}

/** The orderUpdate Loops template's variables */
export interface WarehouseEmailData {
  [key: string]: unknown;
  subject: string;
  preheader: string;
  label: string;
  eyebrow: string;
  headline: string;
  name: string;
  body: string;
  note: { title: string; text: string }[];
  action: { text: string }[];
  ctaLabel: string;
  ctaUrl: string;
  secondary: { label: string; url: string }[];
  steps: unknown[];
  winesTitle: { title: string }[];
  wines: { name: string; detail: string; quantity: string }[];
  winesMore: { text: string }[];
  rows: { label: string; value: string }[];
}
