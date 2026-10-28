import { Suspense } from 'react';

import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

import PricingConfigForm from './PricingConfigForm';

/**
 * Admin pricing configuration page
 *
 * Configure pricing variables for B2B, PCO, and Craft & Culture modules.
 */
const PricingAdminPage = () => {
  return (
    <main className="container space-y-8 py-8 md:py-16">
      <AdminPageHeader
        title="Pricing Configuration"
        description="Configure pricing variables for each commercial model. Changes apply globally to all new calculations."
        className="mx-auto w-full max-w-4xl"
      />
      <Card className="mx-auto w-full max-w-4xl">
        <CardContent>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <PricingConfigForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
};

export default PricingAdminPage;
