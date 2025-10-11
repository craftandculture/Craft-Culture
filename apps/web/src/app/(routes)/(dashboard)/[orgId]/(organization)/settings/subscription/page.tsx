import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import SettingAutomaticTopUp from '@/app/_settings/components/SettingAutomaticTopUp';
import SettingBillingDetails from '@/app/_settings/components/SettingBillingDetails';
import SettingCancelPlan from '@/app/_settings/components/SettingCancelPlan';
import SettingPaymentMandate from '@/app/_settings/components/SettingPaymentMandate';
import SettingPlan from '@/app/_settings/components/SettingPlan';
import SettingTopUp from '@/app/_settings/components/SettingTopUp';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

import type { OrganizationRoute } from '../../../layout';

const Page = async ({ params }: OrganizationRoute) => {
  const { orgId } = await params;

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(
    api.organizations.billingDetails.get.queryOptions({
      organizationId: orgId,
    }),
  );

  void queryClient.prefetchQuery(
    api.organizations.plan.get.queryOptions({
      organizationId: orgId,
    }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SettingPlan />
      <SettingBillingDetails />
      <SettingPaymentMandate />
      <SettingAutomaticTopUp />
      <SettingTopUp />
      <SettingCancelPlan />
    </HydrationBoundary>
  );
};

export default Page;
