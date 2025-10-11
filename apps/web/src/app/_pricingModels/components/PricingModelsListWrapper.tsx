'use client';

import { useSuspenseQuery } from '@tanstack/react-query';

import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Divider from '@/app/_ui/components/Divider/Divider';
import useTRPC from '@/lib/trpc/browser';

import PricingModelsList from './PricingModelsList';

const PricingModelsListWrapper = () => {
  const api = useTRPC();
  const { data: pricingModels } = useSuspenseQuery(
    api.pricingModels.getMany.queryOptions(),
  );

  if (pricingModels.length === 0) {
    return null;
  }

  return (
    <>
      <Divider />
      <CardProse>
        <CardTitle>Your Pricing Models</CardTitle>
        <CardDescription colorRole="muted">
          Manage existing pricing models. Multiple models can reference the
          same sheet.
        </CardDescription>
      </CardProse>
      <PricingModelsList />
    </>
  );
};

export default PricingModelsListWrapper;
