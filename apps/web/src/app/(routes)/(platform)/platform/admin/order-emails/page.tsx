import OrderEmailsAdmin from '@/app/_privateClientOrders/components/OrderEmailsAdmin';

/** Order Emails: the switch for order emails to partners and distributors, and the outbox */
const OrderEmailsPage = () => {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
      <OrderEmailsAdmin />
    </div>
  );
};

export default OrderEmailsPage;
