'use client';

import {
  IconBinoculars,
  IconBrain,
  IconCurrencyDollar,
  IconDatabase,
  IconPencil,
  IconSettings,
  IconShoppingCart,
  IconSparkles,
} from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Tabs from '@/app/_ui/components/Tabs/Tabs';
import TabsContent from '@/app/_ui/components/Tabs/TabsContent';
import TabsList from '@/app/_ui/components/Tabs/TabsList';
import TabsTrigger from '@/app/_ui/components/Tabs/TabsTrigger';

import AdvisorBrief from './AdvisorBrief';
import BuyerBrief from './BuyerBrief';
import CompetitorUpload from './CompetitorUpload';
import ConciergeBrief from './ConciergeBrief';
import PricerBrief from './PricerBrief';
import ScoutBrief from './ScoutBrief';
import StorytellerBrief from './StorytellerBrief';
import StorytellerConfig from './StorytellerConfig';
import SupplierUpload from './SupplierUpload';

/**
 * Intelligence Dashboard - tabbed view for all agent briefs, data uploads, and config
 */
const AgentDashboard = () => {
  return (
    <div className="container space-y-6 py-6">
      <Tabs defaultValue="scout">
        <TabsList>
          <TabsTrigger value="scout">
            <Icon icon={IconBinoculars} size="sm" className="mr-2" />
            Market Scout
          </TabsTrigger>
          <TabsTrigger value="concierge">
            <Icon icon={IconSparkles} size="sm" className="mr-2" />
            PCO Concierge
          </TabsTrigger>
          <TabsTrigger value="storyteller">
            <Icon icon={IconPencil} size="sm" className="mr-2" />
            Socials
          </TabsTrigger>
          <TabsTrigger value="buyer">
            <Icon icon={IconShoppingCart} size="sm" className="mr-2" />
            Purchasing
          </TabsTrigger>
          <TabsTrigger value="pricer">
            <Icon icon={IconCurrencyDollar} size="sm" className="mr-2" />
            Pricing
          </TabsTrigger>
          <TabsTrigger value="advisor">
            <Icon icon={IconBrain} size="sm" className="mr-2" />
            Business
          </TabsTrigger>
          <TabsTrigger value="data">
            <Icon icon={IconDatabase} size="sm" className="mr-2" />
            Data
          </TabsTrigger>
          <TabsTrigger value="config">
            <Icon icon={IconSettings} size="sm" className="mr-2" />
            Config
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

        <TabsContent value="buyer" className="mt-6">
          <BuyerBrief />
        </TabsContent>

        <TabsContent value="pricer" className="mt-6">
          <PricerBrief />
        </TabsContent>

        <TabsContent value="advisor" className="mt-6">
          <AdvisorBrief />
        </TabsContent>

        <TabsContent value="data" className="mt-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <CompetitorUpload />
            <SupplierUpload />
          </div>
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <StorytellerConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgentDashboard;
