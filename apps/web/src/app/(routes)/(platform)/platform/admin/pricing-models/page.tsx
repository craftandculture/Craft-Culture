import { Suspense } from 'react';

import PricingModelsForm from '@/app/_pricingModels/components/PricingModelsForm';
import PricingModelsListSkeleton from '@/app/_pricingModels/components/PricingModelsListSkeleton';
import PricingModelsListWrapper from '@/app/_pricingModels/components/PricingModelsListWrapper';
import UsersWithPricingModelsList from '@/app/_pricingModels/components/UsersWithPricingModelsList';
import UsersWithPricingModelsListSkeleton from '@/app/_pricingModels/components/UsersWithPricingModelsListSkeleton';
import SheetsForm from '@/app/_sheets/components/SheetsForm';
import SheetsListSkeleton from '@/app/_sheets/components/SheetsListSkeleton';
import SheetsListWrapper from '@/app/_sheets/components/SheetsListWrapper';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Divider from '@/app/_ui/components/Divider/Divider';

const PricingModelsAdminPage = () => {
  return (
    <main className="container space-y-8 py-8 md:py-16">
      <Card className="mx-auto w-full max-w-5xl">
        <CardContent>
          <CardProse>
            <CardTitle>Step 1: Upload Sheet</CardTitle>
            <CardDescription colorRole="muted">
              Upload a Google Sheet to store all formulas and data.
            </CardDescription>
          </CardProse>
          <SheetsForm />
          <Suspense fallback={
            <>
              <Divider />
              <CardProse>
                <CardTitle>Your Sheets</CardTitle>
                <CardDescription colorRole="muted">
                  Previously uploaded sheets available for pricing models
                </CardDescription>
              </CardProse>
              <SheetsListSkeleton />
            </>
          }>
            <SheetsListWrapper />
          </Suspense>
        </CardContent>
      </Card>

      <Card className="mx-auto w-full max-w-5xl">
        <CardContent>
          <CardProse>
            <CardTitle>Step 2: Create Pricing Model</CardTitle>
            <CardDescription colorRole="muted">
              Select a sheet and define cell mappings for your pricing model
            </CardDescription>
          </CardProse>
          <PricingModelsForm />
          <Suspense fallback={
            <>
              <Divider />
              <CardProse>
                <CardTitle>Your Pricing Models</CardTitle>
                <CardDescription colorRole="muted">
                  Manage existing pricing models. Multiple models can reference the
                  same sheet.
                </CardDescription>
              </CardProse>
              <PricingModelsListSkeleton />
            </>
          }>
            <PricingModelsListWrapper />
          </Suspense>
        </CardContent>
      </Card>

      <Card className="mx-auto w-full max-w-5xl">
        <CardContent>
          <CardProse>
            <CardTitle>User Assignments</CardTitle>
            <CardDescription colorRole="muted">
              Assign pricing models to users
            </CardDescription>
          </CardProse>
          <Suspense fallback={<UsersWithPricingModelsListSkeleton />}>
            <UsersWithPricingModelsList />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
};

export default PricingModelsAdminPage;
