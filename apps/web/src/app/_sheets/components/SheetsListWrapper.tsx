'use client';

import { useSuspenseQuery } from '@tanstack/react-query';

import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Divider from '@/app/_ui/components/Divider/Divider';
import useTRPC from '@/lib/trpc/browser';

import SheetsList from './SheetsList';

const SheetsListWrapper = () => {
  const api = useTRPC();
  const { data: sheets } = useSuspenseQuery(api.sheets.getMany.queryOptions());

  if (sheets.length === 0) {
    return null;
  }

  return (
    <>
      <Divider />
      <CardProse>
        <CardTitle>Your Sheets</CardTitle>
        <CardDescription colorRole="muted">
          Previously uploaded sheets available for pricing models
        </CardDescription>
      </CardProse>
      <SheetsList />
    </>
  );
};

export default SheetsListWrapper;
