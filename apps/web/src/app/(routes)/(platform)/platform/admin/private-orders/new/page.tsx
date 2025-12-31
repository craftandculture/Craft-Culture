import AdminPrivateOrderForm from '@/app/_privateClientOrders/components/AdminPrivateOrderForm';

/**
 * Admin New Private Client Order page
 *
 * Allows admins to create private client orders.
 */
const AdminNewPrivateOrderPage = () => {
  return (
    <main className="container py-4 landscape:py-2 md:py-16">
      <AdminPrivateOrderForm />
    </main>
  );
};

export default AdminNewPrivateOrderPage;
