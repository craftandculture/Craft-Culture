import PrivateOrderForm from '@/app/_privateClientOrders/components/PrivateOrderForm';

/**
 * New Private Client Order page
 *
 * Allows wine partners to create new orders for their private clients.
 */
const NewPrivateOrderPage = () => {
  return (
    <main className="container py-4 landscape:py-2 md:py-16">
      <PrivateOrderForm />
    </main>
  );
};

export default NewPrivateOrderPage;
