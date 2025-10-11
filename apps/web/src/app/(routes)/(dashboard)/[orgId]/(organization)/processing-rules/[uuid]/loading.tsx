import PanelNodesSkeleton from '@/app/_processing-rules_/components/PanelNodesSkeleton';
import PanelSettingsSkeleton from '@/app/_processing-rules_/components/PanelSettingsSkeleton';
import ProcessingRuleHeaderSkeleton from '@/app/_processing-rules_/components/ProcessingRuleHeaderSkeleton';
import PersistentPanelsGroup from '@/app/_ui/components/Panels/PersistentPanelsGroup';

const Loading = () => {
  return (
    <main>
      <ProcessingRuleHeaderSkeleton />
      <PersistentPanelsGroup
        direction="horizontal"
        cookieName="easybooker.processing-rules_.rule.layout"
        defaultLayout={[40, 60]}
        className="h-[calc(100vh-144px)] max-h-[calc(100vh-144px)]"
      >
        <PanelSettingsSkeleton />
        <PanelNodesSkeleton />
      </PersistentPanelsGroup>
    </main>
  );
};

export default Loading;
