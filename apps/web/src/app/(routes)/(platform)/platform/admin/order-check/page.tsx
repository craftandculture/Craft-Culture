import OrderCheckClient from '@/app/_orderChecks/components/OrderCheckClient';

/**
 * Order & invoice check
 *
 * Checks a sales order, invoice or PCO — or every draft in Zoho — for wrong
 * codes, pack, size and vintage mismatches, missing or below-list prices,
 * currency mix-ups and wine we do not hold, before it reaches the client.
 */
const OrderCheckPage = () => (
  <main className="container py-6">
    <OrderCheckClient />
  </main>
);

export default OrderCheckPage;
