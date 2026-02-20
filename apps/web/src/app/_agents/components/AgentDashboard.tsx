'use client';

import {
  IconBinoculars,
  IconPencil,
  IconSparkles,
  IconUpload,
} from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Tabs from '@/app/_ui/components/Tabs/Tabs';
import TabsContent from '@/app/_ui/components/Tabs/TabsContent';
import TabsList from '@/app/_ui/components/Tabs/TabsList';
import TabsTrigger from '@/app/_ui/components/Tabs/TabsTrigger';

import CompetitorUpload from './CompetitorUpload';
import ConciergeBrief from './ConciergeBrief';
import ScoutBrief from './ScoutBrief';
import StorytellerBrief from './StorytellerBrief';

/**
 * Agent Dashboard - tabbed view for Scout, Concierge, Storyteller briefs + competitor upload
 */
const AgentDashboard = () => {
  return (
    <div className="container space-y-6 py-6">
      <Tabs defaultValue="scout">
        <TabsList>
          <TabsTrigger value="scout">
            <Icon icon={IconBinoculars} size="sm" className="mr-2" />
            The Scout
          </TabsTrigger>
          <TabsTrigger value="concierge">
            <Icon icon={IconSparkles} size="sm" className="mr-2" />
            The Concierge
          </TabsTrigger>
          <TabsTrigger value="storyteller">
            <Icon icon={IconPencil} size="sm" className="mr-2" />
            The Storyteller
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Icon icon={IconUpload} size="sm" className="mr-2" />
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scout" className="mt-6">
          <ScoutBrief />
        </TabsContent>

        <TabsContent value="concierge" className="mt-6">
          <ConciergeBrief />
        </TabsContent>

        <TabsContent value="storyteller" className="mt-6">
          <StorytellerBrief />
        </TabsContent>

        <TabsContent value="upload" className="mt-6">
          <CompetitorUpload />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgentDashboard;
