import { Suspense } from 'react';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

import PricingConfigForm from './PricingConfigForm';

/**
 * Admin pricing configuration page
 *
 * Configure pricing variables for B2B, PCO, and Pocket Cellar modules.
 */
const PricingAdminPage = () => {
  return (
    <main className="container space-y-8 py-8 md:py-16">
      <Card className="mx-auto w-full max-w-4xl">
        <CardContent>
          <CardProse>
            <CardTitle>Pricing Configuration</CardTitle>
            <CardDescription colorRole="muted">
              Configure pricing variables for each commercial model. Changes apply globally to all
              new calculations.
            </CardDescription>
          </CardProse>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <PricingConfigForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
};

export default PricingAdminPage;
