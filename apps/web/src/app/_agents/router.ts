import { createTRPCRouter } from '@/lib/trpc/trpc';

import getAgentConfig from './controllers/getAgentConfig';
import getAgentOutputs from './controllers/getAgentOutputs';
import getCompetitorWines from './controllers/getCompetitorWines';
import getLatestBrief from './controllers/getLatestBrief';
import getSupplierWines from './controllers/getSupplierWines';
import triggerAgent from './controllers/triggerAgent';
import uploadCompetitorList from './controllers/uploadCompetitorList';
import uploadSupplierList from './controllers/uploadSupplierList';
import upsertAgentConfig from './controllers/upsertAgentConfig';

const agentsRouter = createTRPCRouter({
  getAgentConfig,
  getAgentOutputs,
  getCompetitorWines,
  getLatestBrief,
  getSupplierWines,
  triggerAgent,
  uploadCompetitorList,
  uploadSupplierList,
  upsertAgentConfig,
});

export default agentsRouter;
