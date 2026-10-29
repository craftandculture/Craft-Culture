'use client';

import {
  IconAlertTriangle,
  IconArrowDown,
  IconClock,
} from '@tabler/icons-react';

import isUsableLwin18 from '@/app/_lwin/utils/isUsableLwin18';
import Icon from '@/app/_ui/components/Icon/Icon';
import type { PrivateClientOrder } from '@/database/schema';

import { DISTRIBUTOR_SKU_LOCKED_STATUSES } from '../../constants';

type OrderStatus = PrivateClientOrder['status'];

/** Before approval a distributor is not expected yet */
const PRE_APPROVAL_STATUSES: OrderStatus[] = [
  'draft',
  'submitted',
  'under_cc_review',
  'revision_requested',
];

const CLOSED_STATUSES: OrderStatus[] = ['delivered', 'cancelled'];

export interface OrderAttentionPanelProps {
  order: {
    status: OrderStatus;
    distributorSku: string | null;
    distributor: { requiresOrderSku: boolean | null } | null;
    items?: { lwin: string | null }[] | null;
  };
  /** Scroll to a section on the page, by its element id */
  onJump: (sectionId: string) => void;
}

interface AttentionItem {
  key: string;
  tone: 'block' | 'wait';
  text: string;
  jumpTo?: string;
  jumpLabel?: string;
}

/**
 * What stands between this order and its next step, at the top of the page
 *
 * Each line is a decision or a missing piece the admin would otherwise find
 * only by reading every card: no distributor, no distributor SKU, lines without
 * an LWIN, or the order waiting on someone else. Nothing shows when nothing is
 * outstanding. The SKU rule is the same one the list's "CD SKU missing" filter
 * uses.
 */
const OrderAttentionPanel = ({ order, onJump }: OrderAttentionPanelProps) => {
  const items: AttentionItem[] = [];
  const isOpen = !CLOSED_STATUSES.includes(order.status);

  if (
    isOpen &&
    !PRE_APPROVAL_STATUSES.includes(order.status) &&
    !order.distributor
  ) {
    items.push({
      key: 'distributor',
      tone: 'block',
      text: 'No distributor assigned',
      jumpTo: 'pco-distributor',
      jumpLabel: 'Assign',
    });
  }

  if (
    order.distributor?.requiresOrderSku &&
    !order.distributorSku &&
    !DISTRIBUTOR_SKU_LOCKED_STATUSES.includes(order.status)
  ) {
    items.push({
      key: 'sku',
      tone: 'block',
      text: 'Distributor SKU missing — needed before the client pays',
      jumpTo: 'pco-tracker',
      jumpLabel: 'Add SKU',
    });
  }

  const uncoded = (order.items ?? []).filter(
    (item) => !isUsableLwin18(item.lwin),
  ).length;
  if (isOpen && uncoded > 0) {
    items.push({
      key: 'lwin',
      tone: 'block',
      text: `${uncoded} line${uncoded === 1 ? '' : 's'} without an LWIN — the Zoho sales order cannot be raised until each is coded`,
      jumpTo: 'pco-line-items',
      jumpLabel: 'Set LWIN',
    });
  }

  if (order.status === 'awaiting_partner_verification') {
    items.push({
      key: 'wait-partner',
      tone: 'wait',
      text: 'Waiting for the wine partner to verify the client',
    });
  }
  if (order.status === 'awaiting_distributor_verification') {
    items.push({
      key: 'wait-distributor',
      tone: 'wait',
      text: 'Waiting for the distributor to verify the client',
    });
  }
  if (order.status === 'awaiting_client_payment') {
    items.push({
      key: 'wait-payment',
      tone: 'wait',
      text: 'Waiting for the client to pay',
    });
  }

  if (items.length === 0) return null;

  const blocking = items.filter((item) => item.tone === 'block').length;

  return (
    <section
      aria-label="Needs attention"
      className={`rounded-xl border px-4 py-3 ${
        blocking > 0
          ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-500/10'
          : 'border-border-muted bg-surface-secondary/50'
      }`}
    >
      <p className="text-text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
        {blocking > 0 ? `Needs attention · ${blocking}` : 'Waiting on others'}
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
          >
            <span className="text-text-primary flex min-w-0 items-start gap-2 text-sm">
              <Icon
                icon={item.tone === 'block' ? IconAlertTriangle : IconClock}
                size="sm"
                className={`mt-0.5 shrink-0 ${
                  item.tone === 'block'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-text-muted'
                }`}
              />
              {item.text}
            </span>
            {item.jumpTo && (
              <button
                type="button"
                onClick={() => onJump(item.jumpTo!)}
                className="border-border-muted bg-surface-primary text-text-primary hover:bg-fill-muted inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
              >
                {item.jumpLabel}
                <Icon icon={IconArrowDown} size="xs" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default OrderAttentionPanel;
