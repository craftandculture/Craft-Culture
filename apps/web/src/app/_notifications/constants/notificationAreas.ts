import {
  IconBell,
  IconBottle,
  IconCash,
  IconFileInvoice,
  IconSearch,
  IconShieldCheck,
  IconShoppingCart,
  IconTruck,
} from '@tabler/icons-react';

/**
 * The areas a notification can belong to, in the order the filters show them
 *
 * Ids match the categories in getNotificationCategories, so a type's area is
 * the category its preference already sits under.
 */
const notificationAreas = [
  { id: 'cellar', label: 'Cellar', icon: IconBottle },
  { id: 'quotes', label: 'Orders', icon: IconFileInvoice },
  { id: 'purchase_orders', label: 'Purchasing', icon: IconShoppingCart },
  { id: 'payments', label: 'Payments', icon: IconCash },
  { id: 'sourcing', label: 'Sourcing', icon: IconSearch },
  { id: 'logistics', label: 'Logistics', icon: IconTruck },
  { id: 'admin', label: 'Admin', icon: IconShieldCheck },
  { id: 'general', label: 'General', icon: IconBell },
] as const;

export type NotificationAreaId = (typeof notificationAreas)[number]['id'];

export default notificationAreas;
