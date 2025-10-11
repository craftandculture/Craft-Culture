import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import NodesContextProvider from '@/app/_processing-rules_/components/NodesContextProvider';
import PanelNodes from '@/app/_processing-rules_/components/PanelNodes';
import PanelSettings from '@/app/_processing-rules_/components/PanelSettings';
import ProcessingRuleFormProvider from '@/app/_processing-rules_/components/ProcessingRuleFormProvider';
import ProcessingRuleHeader from '@/app/_processing-rules_/components/ProcessingRuleHeader';
import PersistentPanelsGroup from '@/app/_ui/components/Panels/PersistentPanelsGroup';
import ResizableHandle from '@/app/_ui/components/Resizable/ResizableHandle';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

import type { OrganizationRoute } from '../../../layout';

const Page = async ({ params }: OrganizationRoute<{ uuid: string }>) => {
  const { orgId, uuid } = await params;

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(
    api.processingRules_.get.queryOptions({
      organizationId: orgId,
      processingRuleId: uuid,
    }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main>
        <ProcessingRuleHeader />
        <ProcessingRuleFormProvider>
          <NodesContextProvider>
            <PersistentPanelsGroup
              direction="horizontal"
              cookieName="easybooker.processing-rules_.rule.layout"
              defaultLayout={[40, 60]}
              className="h-[calc(100vh-144px)] max-h-[calc(100vh-144px)]"
            >
              <PanelSettings />
              <ResizableHandle />
              <PanelNodes />
            </PersistentPanelsGroup>
          </NodesContextProvider>
        </ProcessingRuleFormProvider>
      </main>
    </HydrationBoundary>
  );
};

export default Page;
