import {
  IconBottle,
  IconBox,
  IconChecklist,
  IconFileAlert,
  IconFileInvoice,
  IconPackage,
  IconPlane,
  IconSearch,
  IconShieldLock,
  IconShoppingCart,
  IconTag,
  IconTruck,
  IconTruckDelivery,
  IconUserCheck,
  type Icon as TablerIcon,
} from '@tabler/icons-react';

import type { Notification } from '@/database/schema';

import getNotificationIcon from './getNotificationIcon';

interface Subject {
  icon: TablerIcon;
  /** What the notification is about, as a reader names it */
  noun: string;
}

/*
  Keyed on the record a notification points at, not its type: several flows
  reuse one type (a UK move and a release both send cellar_release_submitted),
  but each names its own record.
*/
const SUBJECTS: Record<string, Subject> = {
  sale_mandate: { icon: IconTag, noun: 'Sale offer' },
  cellar_release_request: { icon: IconTruckDelivery, noun: 'Release' },
  cellar_uk_move: { icon: IconPlane, noun: 'UK move' },
  private_client_order: { icon: IconPackage, noun: 'Order' },
  quote: { icon: IconFileInvoice, noun: 'Quote' },
  user: { icon: IconUserCheck, noun: 'Account' },
  cellar_application: { icon: IconUserCheck, noun: 'Application' },
  cellar_invite: { icon: IconUserCheck, noun: 'Invite' },
  cellar_access: { icon: IconUserCheck, noun: 'Cellar access' },
  cellar_access_grant: { icon: IconUserCheck, noun: 'Cellar access' },
  cellar_membership: { icon: IconUserCheck, noun: 'Membership' },
  source_rfq: { icon: IconSearch, noun: 'Sourcing request' },
  cellar_sourcing_request: { icon: IconSearch, noun: 'Sourcing request' },
  supplier_order: { icon: IconShoppingCart, noun: 'Supplier order' },
  source_po: { icon: IconShoppingCart, noun: 'Purchase order' },
  logistics_shipment: { icon: IconTruck, noun: 'Shipment' },
  logistics_document: { icon: IconFileAlert, noun: 'Document' },
  team_task: { icon: IconChecklist, noun: 'Task' },
  wms_stock: { icon: IconBox, noun: 'Stock' },
  cellar_purchase: { icon: IconBottle, noun: 'Purchase' },
  cellar_allocation: { icon: IconBottle, noun: 'Allocation' },
  session: { icon: IconShieldLock, noun: 'Sign-in' },
};

/**
 * What a notification is about: its icon and the name of its record
 *
 * Falls back to the notification area's icon and a plain noun when the
 * notification does not name a record.
 *
 * @example
 *   getNotificationSubject({ entityType: 'cellar_uk_move', ... });
 *   // { icon: IconPlane, noun: 'UK move' }
 *
 * @param notification - The notification
 * @returns The icon and noun to show
 */
const getNotificationSubject = (
  notification: Pick<Notification, 'entityType' | 'type'>,
): Subject =>
  (notification.entityType && SUBJECTS[notification.entityType]) || {
    icon: getNotificationIcon(notification.type),
    noun: 'Notification',
  };

export default getNotificationSubject;
